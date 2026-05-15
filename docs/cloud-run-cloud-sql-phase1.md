# Cloud Run + Cloud SQL Phase 1 Deployment

This document records the Phase 1 Google Cloud deployment for the backend API.
It intentionally excludes secret values.

## Project

| Item | Value |
|------|-------|
| GCP project | `cnad-safety-response` |
| Region | `asia-east1` |
| Cloud Run service | `safety-response-api` |
| Cloud SQL instance | `employee-safety-db` |
| Database | `employee_safety` |
| Runtime service account | `safety-app-sa@cnad-safety-response.iam.gserviceaccount.com` |

## Cloud SQL

Cloud SQL was provisioned as PostgreSQL 15 in `asia-east1`.

| Setting | Value |
|---------|-------|
| Instance | `employee-safety-db` |
| Database version | `POSTGRES_15` |
| Tier | `db-custom-1-3840` |
| Availability | `ZONAL` Phase 1 single primary |
| Public IPv4 | Disabled |
| Private IP | Enabled, `10.89.0.3` |
| VPC | `default` |
| Backup retention | 7 retained backups |
| PITR | Enabled, 7 transaction log retention days |

The instance connection name is:

```text
cnad-safety-response:asia-east1:employee-safety-db
```

## Secret Manager

The backend uses Secret Manager for production secrets.

| Secret | Purpose |
|--------|---------|
| `employee-safety-db-password` | Cloud SQL `app_user` password |
| `employee-safety-database-url` | SQLAlchemy `DATABASE_URL` for the Cloud SQL Unix socket |
| `employee-safety-jwt-secret` | Backend JWT signing secret |

The `DATABASE_URL` secret uses this shape:

```text
postgresql+psycopg://app_user:REDACTED@/employee_safety?host=/cloudsql/cnad-safety-response:asia-east1:employee-safety-db
```

## Cloud Run

The backend is deployed to Cloud Run from `backend/Dockerfile`.

The container must listen on the Cloud Run-provided `PORT`, so the Dockerfile command uses:

```sh
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Cloud Run is configured with:

| Setting | Value |
|---------|-------|
| Cloud SQL binding | `cnad-safety-response:asia-east1:employee-safety-db` |
| VPC network | `default` |
| Subnet | `default` in `asia-east1` |
| VPC egress | `private-ranges-only` |
| `ENV` | `production` |
| `USE_GCP` | `false` |
| `REDIS_ENABLED` | `false` |
| `DATABASE_URL` | Secret `employee-safety-database-url:latest` |
| `JWT_SECRET` | Secret `employee-safety-jwt-secret:latest` |

`REDIS_ENABLED=false` is intentional for Phase 1 because Memorystore is not deployed yet.

## Deploy Command

```bash
gcloud run deploy safety-response-api \
  --source backend \
  --region asia-east1 \
  --service-account=safety-app-sa@cnad-safety-response.iam.gserviceaccount.com \
  --add-cloudsql-instances=cnad-safety-response:asia-east1:employee-safety-db \
  --network=default \
  --subnet=default \
  --vpc-egress=private-ranges-only \
  --set-env-vars=ENV=production,USE_GCP=false,REDIS_ENABLED=false \
  --set-secrets=DATABASE_URL=employee-safety-database-url:latest,JWT_SECRET=employee-safety-jwt-secret:latest \
  --allow-unauthenticated \
  --quiet
```

## Verification

Current Cloud Run health check:

```bash
curl -sS https://safety-response-api-959534192972.asia-east1.run.app/health
```

Expected response:

```json
{"status":"ok","app":"ok","database":"ok","redis":"skipped"}
```

## Phase 1 Scope Notes

Completed:

- Cloud SQL for PostgreSQL in `asia-east1`
- Private IP Cloud SQL with public IPv4 disabled
- Private Service Access for the VPC
- Cloud Run to Cloud SQL via Unix socket and Cloud SQL binding
- Cloud Run attached to the same VPC for private egress
- Secret Manager-backed production `DATABASE_URL` and `JWT_SECRET`
- Automated Alembic migration on container startup
- Automated backups and PITR enabled

Not completed in Phase 1:

- Cloud SQL HA mode. This is Phase 2.
- Memorystore Redis read offloading. `REDIS_ENABLED=false` until Memorystore is provisioned.
- Pub/Sub write-path buffering for safety reports. Current report writes still go through the synchronous FastAPI path.
- Multi-region read replicas. This is Phase 3.
