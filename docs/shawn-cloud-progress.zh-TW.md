# Shawn 工作進度：雲端部署狀態

本文整理 Shawn 目前負責的雲端部署進度，以及各項服務如何開啟、驗證與後續擴充。

## 目前完成狀態

目前已完成前端、後端與資料庫的主要雲端部署。

前端已部署到 Firebase Hosting，正式網址是：

```text
https://cnad-safety-response.web.app
```

後端已部署到 Google Cloud Run，服務名稱是 `safety-response-api`，部署區域是 `asia-east1`。

資料庫已部署到 Cloud SQL for PostgreSQL，instance 名稱是 `employee-safety-db`，database 名稱是 `employee_safety`。

目前 Redis 尚未上雲，因此 health check 中出現 `redis: skipped` 是預期狀態，不是錯誤。

Pub/Sub 和 FCM production 通知目前也尚未正式完成，屬於下一階段要補的 section。

## 組員開發是否還需要本地 Docker

現在前端、後端和資料庫都已經有雲端版本，所以如果組員只是要使用系統、測 demo、驗收功能，基本上不需要在本地啟動 Docker。

可以直接使用前端網址：

```text
https://cnad-safety-response.web.app
```

這個前端會連到已部署在 Cloud Run 的後端 API，後端再連到 Cloud SQL 資料庫。因此一般使用者或組員測試畫面時，不需要自己在電腦上開 Docker、Postgres 或 backend container。

不過，如果組員要進行開發，是否需要 Docker 要看開發內容。

如果只改前端畫面或前端互動，可以不依賴 Docker。前端可以用本機 Vite dev server 開發：

```bash
npm run dev --prefix frontend
```

如果前端要直接連雲端後端，可以設定 API URL 為 Cloud Run：

```bash
VITE_API_URL=https://safety-response-api-zc5lsyet2q-de.a.run.app
```

如果組員要改後端 API，仍然建議使用本地 Docker Compose 或本地 Python 環境進行開發與測試。原因是後端開發通常會牽涉到資料庫、migration、測試資料和 API 行為驗證，直接使用雲端 Cloud SQL 來測試比較容易影響 shared data。

如果組員要改資料庫 schema 或 Alembic migration，更建議使用本地 Docker Postgres 先測試。確認 migration 可以正常執行、測試通過後，再部署到 Cloud Run，讓新的後端 revision 套用到 Cloud SQL。

因此目前的結論是：

一般 demo / 驗收不需要依賴本地 Docker。

只改前端時，可以不使用 Docker。

改後端 API 時，建議仍使用本地 Docker Compose 或本地 Python 環境。

改資料庫 schema / migration 時，建議一定先用本地 Docker Postgres 測試。

本地 Dockerfile 和 docker-compose 仍然要保留，因為它們是後端開發、資料庫測試、migration 驗證和 CI 類工作的重要基礎。

## 前端：Firebase Hosting

前端目前已經上雲到 Firebase Hosting。

Firebase project 是：

```text
cnad-safety-response
```

Hosting site 是：

```text
cnad-safety-response
```

前端正式網址是：

```text
https://cnad-safety-response.web.app
```

要查看目前 Firebase project，可以執行：

```bash
firebase projects:list
```

要查看 Firebase Hosting site，可以執行：

```bash
firebase hosting:sites:list --project cnad-safety-response
```

重新 build 前端時，需要指定 Cloud Run 後端 API URL，否則前端會打到 Firebase Hosting 自己的 `/api`。

Build 指令如下：

```bash
VITE_API_URL=https://safety-response-api-zc5lsyet2q-de.a.run.app npm run build --prefix frontend
```

部署前端到 Firebase Hosting 的指令如下：

```bash
firebase deploy --only hosting --project cnad-safety-response
```

## 後端：Cloud Run

後端目前已經上雲到 Google Cloud Run。

Cloud Run service 名稱是：

```text
safety-response-api
```

Cloud Run URL 是：

```text
https://safety-response-api-zc5lsyet2q-de.a.run.app
```

要查看 Cloud Run 後端服務，可以執行：

```bash
gcloud run services list --region asia-east1
```

要確認後端是否正常，可以打 health check：

```bash
curl https://safety-response-api-zc5lsyet2q-de.a.run.app/health
```

目前預期回應如下：

```json
{"status":"ok","app":"ok","database":"ok","redis":"skipped"}
```

這代表後端 app 正常，Cloud SQL database 連線正常，而 Redis 因為尚未上雲，所以目前被略過。

## 資料庫：Cloud SQL

資料庫目前已經上雲到 Cloud SQL for PostgreSQL。

Cloud SQL instance 名稱是：

```text
employee-safety-db
```

Database 名稱是：

```text
employee_safety
```

Cloud Run 透過 Secret Manager 中的 `DATABASE_URL` 連線到 Cloud SQL。也就是說 production 的資料庫連線字串沒有寫死在 repo 裡，而是從 Secret Manager 讀取。

要查看 Cloud SQL instance，可以執行：

```bash
gcloud sql instances list
```

如果 health check 回傳 `database: ok`，代表 Cloud Run 已成功連到 Cloud SQL。

## Redis 目前狀態

Redis 目前尚未部署到雲端。

Cloud Run 現在設定為：

```text
REDIS_ENABLED=false
```

因此 health check 中看到：

```text
redis: skipped
```

是目前預期狀態。

後續如果要啟用 Redis，需要建立 Cloud Memorystore for Redis，並且讓 Cloud Run 可以透過 VPC 連到 Memorystore。接著要在 Cloud Run 設定正式的 `REDIS_URL`，再把 `REDIS_ENABLED` 改成 `true`。

Redis 啟用後，可以用在 dashboard cache、JWT blacklist，或其他需要快取的功能。

## Pub/Sub 目前狀態

Pub/Sub 目前尚未正式接入 production 流程。

目前程式中已有 Pub/Sub placeholder 和 internal endpoint 的方向，但 production 還沒有完整啟用。

後續如果要啟用 Pub/Sub，需要建立 Pub/Sub topic 和 subscription。如果使用 push subscription，subscription 的 push endpoint 要指向 Cloud Run 的 internal route。Cloud Run 也需要設定 topic 名稱，並把 `USE_GCP` 改成 `true`。

另外，internal endpoint 目前還需要補上 OIDC 驗證，確保只有合法的 Pub/Sub request 可以呼叫內部通知流程。

## FCM Production 通知目前狀態

FCM production 通知目前尚未正式接上。

前端目前已經具備 PWA / Firebase Hosting 基礎，但 `firebase-messaging-sw.js` 還沒有正式設定。後端目前的通知發送也仍偏向 mock / placeholder。

後續如果要啟用 FCM，需要先在 Firebase Console 建立 Web App / Messaging 設定，然後把 Firebase config 接到前端。前端需要向 Firebase Messaging 取得 device token，並把 token 存到後端資料庫。

後端則需要接 Firebase Admin SDK，之後才能用 FCM 發送正式 push notification。

## 總結

目前 Shawn 已完成雲端部署的主要基礎。

前端已上 Firebase Hosting。

後端已上 Cloud Run。

資料庫已上 Cloud SQL。

Secret Manager 已用於後端 production secrets。

Cloud Run health check 已確認 app 與 database 正常。

下一階段重點是補齊 Redis / Memorystore、Pub/Sub 非同步流程，以及 FCM production 通知。
