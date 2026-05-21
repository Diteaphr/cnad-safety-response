# 後端連線資料庫與重灌 Demo 假資料

本文件說明如何在開發環境讓 **FastAPI 後端**連上 **PostgreSQL**，以及如何執行 **`scripts/dev_reseed_demo.py`** 將種子假資料寫入資料庫。

更完整的全端流程（Docker 全棧、Vite 混合模式）見專案根目錄 [README.md](../README.md)。

---

## 前置條件

| 項目 | 說明 |
|------|------|
| PostgreSQL | 本專案預設用 **Docker Compose** 的 Postgres（主機埠 **15432**）。亦可改用本機安裝的 Postgres（常見 **5432**）。 |
| Python | **3.11+**（與 `backend/Dockerfile` 一致）。 |
| 依賴 | 在 `backend/` 建立 venv 並 `pip install -r requirements.txt`（或 `requirements-test.txt`，含測試依賴）。 |

---

## 步驟一：啟動資料庫

### 選項 A：用專案根目錄的 Docker Compose（建議）

在**專案根目錄**執行（只開資料庫與 Redis，不佔用 8000/3000 亦可）：

```bash
docker compose up -d postgres redis
```

確認服務健康：

```bash
docker compose ps
```

預設連線參數（從主機連進容器對映的埠）：

| 欄位 | 值 |
|------|-----|
| Host | `127.0.0.1` 或 `localhost` |
| Port | **15432**（對映容器內 5432；勿用主機 5432 除非你真的在本機另跑一個 Postgres） |
| Database | `employee_safety` |
| User | `user` |
| Password | `password` |

測試用資料庫 `employee_safety_test` 會由 `postgres-init/01-create-test-db.sql` 在首次初始化時建立；**重灌腳本預設操作的是 `DATABASE_URL` 指向的庫（一般為 `employee_safety`）**。

### 選項 B：本機已安裝的 PostgreSQL

自行建立資料庫與帳號後，在 `backend/.env` 的 `DATABASE_URL` 改成你的連線字串（例如埠 **5432**）。

---

## 步驟二：設定後端環境變數（`.env`）

在 **`backend/`** 目錄：

```bash
cd backend
cp .env.example .env
```

編輯 `backend/.env`，至少確認：

```env
ENV=development
DATABASE_URL=postgresql+psycopg://user:password@localhost:15432/employee_safety
```

- 使用 **Docker Postgres** 時：維持 **15432**（與 `docker-compose.yml` 的 `ports` 一致）。
- 使用 **本機 Postgres 聽 5432** 時：把 host/port 改成你的設定。

應用程式透過 `app.core.config.Settings` 讀取 `DATABASE_URL`，並在 `app.core.database` 建立 SQLAlchemy engine。

---

## 步驟三：套用資料庫 Schema（Alembic）

**必須先執行 migration**，資料表存在後才能跑種子腳本或啟動 API 寫入業務資料。

在 **`backend/`** 目錄、已啟用 venv：

```bash
cd backend
alembic upgrade head
```

若使用 Docker 後端容器（且已掛載 `./backend`），也可：

```bash
docker compose exec backend alembic upgrade head
```

---

## 步驟四：重灌 Demo 假資料（`dev_reseed_demo.py`）

### 這支腳本做什麼？

- 呼叫 `app.seeding.seed_demo.reset_and_seed_demo`：**清空主要業務表資料並保留 `roles`**，再寫入種子部門、使用者、事件類型、事件、安全回報等（見 `backend/app/seeding/seed_demo.py`）。
- **不是** HTTP API，也**不會**在 FastAPI 啟動時自動執行。
- 若 `backend/.env` 中 **`ENV`（或等同設定）為 `production` / `prod`**，腳本會**拒絕執行**，避免誤刪正式資料。

### 在本機終端機執行（建議）

**工作目錄必須是 `backend/`**，讓 `app` 套件與 `alembic` 路徑正確；並設定 **`PYTHONPATH=.`** 讓 Python 能找到 `app`：

```bash
cd backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate

PYTHONPATH=. python scripts/dev_reseed_demo.py
```

成功時會印出：

```text
Demo data reseeded OK (manual dev CLI).
```

若已安裝 [uv](https://github.com/astral-sh/uv)：

```bash
cd backend
uv run python scripts/dev_reseed_demo.py
```

（`uv run` 會在專案環境中執行；若遇 import 問題，仍可加上 `PYTHONPATH=.`。）

### 在 Docker 後端容器內執行

當 `docker compose` 已啟動 `backend`，且 volume 掛載了本機 `backend/`（腳本路徑為容器內 `/app`）：

```bash
docker compose exec backend sh -c "cd /app && PYTHONPATH=. python scripts/dev_reseed_demo.py"
```

---

## 步驟五：啟動後端 API

在 **`backend/`**、venv 已啟用：

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

驗證：

- 瀏覽器或 curl：`http://127.0.0.1:8000/health`
- OpenAPI：`http://127.0.0.1:8000/docs`
- 範例：`GET http://127.0.0.1:8000/api/departments` 應回傳 JSON。

使用 **Docker 全棧**時，後端由 compose 啟動，啟動指令內已含 `alembic upgrade head`；若你**改過 schema 或想強制重灌種子**，仍可在容器內手動再跑一次 `dev_reseed_demo.py`（注意會清空業務資料）。

---

## 常見問題

| 狀況 | 處理方式 |
|------|----------|
| `connection refused` 連 Postgres | 確認 Docker 已起、埠為 **15432**；`DATABASE_URL` 與實際埠一致。 |
| `ModuleNotFoundError: No module named 'app'` | 請在 **`backend/`** 執行，並加上 **`PYTHONPATH=.`**。 |
| `relation ... does not exist` | 先執行 **`alembic upgrade head`**。 |
| 想在正式環境跑重灌 | **不要**。腳本會阻擋 `production`；僅限開發庫使用。 |

---

## 與「空庫自動種子」的差異

FastAPI 啟動時若 `users` 表為空，會呼叫 **`run_if_empty`** 只做**初次**輕量種子（見 `backend/app/main.py` 與 `seed_demo.run_if_empty`）。  
**`dev_reseed_demo.py`** 則是 **強制清空業務資料後整包重灌**，適合開發中途想還原成一致 Demo 狀態時使用。

---

## 相關檔案

| 路徑 | 用途 |
|------|------|
| `backend/.env.example` | 環境變數範本 |
| `backend/app/core/database.py` | Engine / `SessionLocal` |
| `backend/scripts/dev_reseed_demo.py` | 重灌 CLI 進入點 |
| `backend/app/seeding/seed_demo.py` | 清空與插入種子邏輯 |
| `docker-compose.yml` | Postgres 埠對映、後端環境變數 |
| [docs/DATABASE_TABLES.md](./DATABASE_TABLES.md) | 資料表說明 |
