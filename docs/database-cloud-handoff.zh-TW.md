# 資料庫上雲交接文件

本文說明 `cloud` branch 目前完成的變更、已建立的 GCP 資源，以及後續負責資料庫建置的組員可以如何修改、擴充與測試。

## 這個 Branch 改了什麼

目前此 branch 的 repo 變更包含以下幾個檔案。

`backend/Dockerfile`

- 將啟動 port 從寫死 `8000` 改成 `${PORT:-8000}`。
- 將 `EXPOSE` 改為 `8080`。
- 原因是 Cloud Run 會用環境變數 `PORT=8080` 要求 container 監聽指定 port；本機沒有設定 `PORT` 時仍會 fallback 到 `8000`。

`README.md`

- 新增 Cloud Run → Cloud SQL 的文件連結。
- 目的是讓組員知道 production DB 連線不再只看本機 Docker Compose。

`docs/cloud-run-cloud-sql-phase1.md`

- 新增 Phase 1 部署紀錄。
- 內容包含目前 GCP 資源、部署命令、Secret Manager、Cloud SQL 設定與驗證方式。

`docs/database-cloud-handoff.zh-TW.md`

- 新增本交接文件。
- 目的是給資料庫組員後續維護與擴充使用。

目前沒有把任何真實密碼、JWT secret 或 service account key 寫進 repo。

## 已完成的雲端資源

目前 GCP project 是：

```text
cnad-safety-response
```

已建立的主要資源如下。

- Cloud SQL instance：`employee-safety-db`
- Database：`employee_safety`
- DB engine：PostgreSQL 15
- Region：`asia-east1`
- Cloud SQL public IP：已關閉
- Cloud SQL private IP：`10.89.0.3`
- Cloud Run service：`safety-response-api`
- Cloud Run URL：`https://safety-response-api-zc5lsyet2q-de.a.run.app`
- Runtime service account：`safety-app-sa@cnad-safety-response.iam.gserviceaccount.com`
- VPC：`default`
- VPC egress：`private-ranges-only`

Secret Manager 目前保存以下 secrets。

- `employee-safety-db-password`：`app_user` 的 Cloud SQL 密碼
- `employee-safety-database-url`：production `DATABASE_URL`
- `employee-safety-jwt-secret`：production `JWT_SECRET`

`DATABASE_URL` 的格式如下，真實密碼存在 Secret Manager，不應寫進 repo：

```text
postgresql+psycopg://app_user:REDACTED@/employee_safety?host=/cloudsql/cnad-safety-response:asia-east1:employee-safety-db
```

## 目前資料庫 Schema 怎麼維護

本 repo 使用 SQLAlchemy + Alembic。

- `backend/app/models/`：SQLAlchemy ORM models
- `backend/alembic/versions/`：DB migration 檔案
- `backend/alembic/env.py`：Alembic 讀取 `DATABASE_URL` 並執行 migration
- `backend/app/core/database.py`：SQLAlchemy engine / session 設定

Cloud Run 的 backend container 啟動時會先執行：

```bash
alembic upgrade head
```

所以新 revision 啟動時會自動把 migration 套到 Cloud SQL。

## 後續要修改 Schema 時怎麼做

建議流程：

1. 在自己的 feature branch 修改 `backend/app/models/`。
2. 新增 Alembic migration 到 `backend/alembic/versions/`。
3. 先在本機 Docker Postgres 測試 migration。
4. 跑 backend tests。
5. 確認 migration 可重複部署，不依賴本機資料。
6. PR review 後再部署 Cloud Run，讓 Cloud Run 啟動時套 migration。

本機測試流程：

```bash
docker compose up -d postgres redis
cd backend
source .venv/bin/activate
alembic upgrade head
pytest
```

如果要產生 migration，可在 `backend/` 裡執行：

```bash
alembic revision --autogenerate -m "describe schema change"
```

產生後一定要人工檢查 migration 內容，尤其是：

- 是否誤刪資料表或欄位
- foreign key 是否正確
- enum / string status 是否符合目前程式邏輯
- migration downgrade 是否合理
- production DB 已有資料時是否會失敗

## 後續可以怎麼擴充

### Phase 1 維護項目

目前已完成「資料庫上雲」的 Phase 1：Cloud SQL private IP + Cloud Run + Secret Manager。

可以接著補強：

- 檢查 connection pool 是否符合 Cloud Run scale 設定。
- 檢查常用查詢是否需要 index。
- 補 DB schema 文件，例如 ERD 與欄位說明。
- 補 production seed 策略，避免 demo seed 污染正式資料。
- 建立資料備份還原演練流程。

### Phase 2 高可用性

0421 架構文件中 Phase 2 要求 Cloud SQL HA。

可規劃：

- 將 Cloud SQL 從 `ZONAL` 改為 `REGIONAL` HA。
- 驗證 failover 後 Cloud Run 是否能自動恢復連線。
- 檢查 backup / PITR / maintenance window 是否符合課程文件。
- 設定 Cloud Monitoring alert，例如 CPU、storage、connection 使用率。

### Phase 2 / Phase 3 效能與高併發

目前系統還沒有完整實作 0421 文件中的高併發保護。

後續可以拆成三條線。

Connection Pooling

- 目前狀態：SQLAlchemy 已有 pool 設定，但尚未依 Cloud Run scale 重新計算。
- 後續方向：根據 Cloud SQL max connections、Cloud Run max instances、每 instance pool size 做容量規劃。

Write-path buffering

- 目前狀態：安全回報目前仍是同步寫 DB。
- 後續方向：導入 Pub/Sub，API 先 enqueue，再由 worker 消費並寫入 PostgreSQL。

Read offloading

- 目前狀態：Redis 尚未部署，Cloud Run 設定為 `REDIS_ENABLED=false`。
- 後續方向：建 Memorystore，將 dashboard 統計快取到 Redis。

### Phase 3 多區域

Phase 3 可考慮：

- Cloud SQL read replica。
- 跨區備份還原演練。
- 多 region Cloud Run。
- 前端 CDN 或靜態 hosting。

## 測試方式

### 1. 確認 Cloud Run 可以連 Cloud SQL

```bash
curl -sS https://safety-response-api-zc5lsyet2q-de.a.run.app/health
```

預期：

```json
{"status":"ok","app":"ok","database":"ok","redis":"skipped"}
```

`redis` 是 `skipped` 是正常的，因為 Phase 1 還沒有部署 Memorystore。

### 2. 確認 Cloud SQL 是 private IP only

```bash
gcloud sql instances describe employee-safety-db \
  --format='yaml(name,region,state,ipAddresses,settings.ipConfiguration)'
```

應確認：

- `ipAddresses` 只有 `PRIVATE`
- `ipv4Enabled: false`
- `privateNetwork` 指向 project 的 VPC

### 3. 確認 Cloud Run 設定

```bash
gcloud run services describe safety-response-api \
  --region asia-east1 \
  --format='yaml(status.url,status.latestReadyRevisionName,spec.template.spec.serviceAccountName,spec.template.metadata.annotations,spec.template.spec.containers[0].env)'
```

應確認：

- 有 `run.googleapis.com/cloudsql-instances`
- 有 `run.googleapis.com/network-interfaces`
- `vpc-access-egress` 是 `private-ranges-only`
- `DATABASE_URL` 和 `JWT_SECRET` 來自 Secret Manager
- runtime service account 是 `safety-app-sa@cnad-safety-response.iam.gserviceaccount.com`

### 4. 確認 migration 已套用

可從 Cloud Run API 行為驗證：

```bash
curl -sS https://safety-response-api-zc5lsyet2q-de.a.run.app/api/departments
curl -sS https://safety-response-api-zc5lsyet2q-de.a.run.app/api/event-types
```

若 schema 沒有正確建立，這些 API 通常會回 DB error。

### 5. 本機測試

本機仍可用 Docker Compose：

```bash
docker compose up --build
```

或只啟 DB：

```bash
docker compose up -d postgres redis
cd backend
alembic upgrade head
pytest
```

注意：`backend/Dockerfile` 雖然 `EXPOSE 8080`，但指令使用 `${PORT:-8000}`，所以本機 Docker Compose 沒有設定 `PORT` 時仍會跑在 `8000`。

## 注意事項

- 不要 commit `.env` 裡的 production secret。
- 不要把 Secret Manager 的值貼到文件或 PR。
- production schema change 必須走 Alembic migration。
- destructive migration，例如 drop column / drop table，必須先確認資料備份與回復策略。
- Cloud SQL 目前是 Phase 1 單主實例，不是 HA。
- Cloud Run 目前允許 unauthenticated request，這是 API 公開方式；後續若要收斂存取權限，需同步調整前端與 auth flow。
