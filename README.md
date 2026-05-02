# CNAD Safety Response System

Employee safety reporting prototype: React SPA + FastAPI backend + PostgreSQL (three-layer API → service → repository). Follow the sections below to run **frontend, backend, and database** together.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| **Git** | Clone this repository |
| **Docker Desktop** (or Docker Engine + Compose v2) | Postgres, Redis, and optional all-in-one stack |
| **Node.js 20+** | Local Vite dev server (`frontend/`) |
| **Python 3.11+** | Run the API on your machine (optional hybrid workflow) |

---

## First-time setup (after `git clone`)

1. From the **repository root**, choose **one** path below:
   - **Path A — Docker everything** (simplest for backend + DB + hosted UI)
   - **Path B — Hybrid** (best for active frontend work: Vite hot reload + Docker DB)

2. You do **not** need `npm install` at the repo root unless you use the root npm scripts; root `package.json` only wires Docker commands.

---

## Path A — Full stack in Docker (recommended to “just run it”)

### Start

From the **repository root**:

```bash
docker compose up --build -d
```

**Detached** (runs in background). To watch logs: `docker compose logs -f backend`.

**Alternative:** attached logs in the current terminal (blocks until you press Ctrl+C):

```bash
npm run dev
```

(`npm run dev` is the same as `docker compose up --build` **without** `-d`.)

**Shortcut for detached:**

```bash
npm run dev:detach
```

Wait ~30–60s on first pull/build. Postgres must pass its healthcheck before the backend starts.

### Verify

| Check | Expected |
|-------|----------|
| [http://localhost:8000/health](http://localhost:8000/health) | JSON with `"status": "ok"` (and DB/redis fields) |
| [http://localhost:8000/api/departments](http://localhost:8000/api/departments) | JSON with a `departments` array (404 ⇒ wrong/old backend image — rebuild: `docker compose up --build -d backend`) |
| [http://localhost:3000](http://localhost:3000) | SPA (nginx). API calls use `/api/*` proxied to the `backend` service |

### Default credentials (local Docker Postgres)

Connect from your host (e.g. TablePlus, `psql`, DBeaver):

```text
Host:     127.0.0.1
Port:     15432        ← mapped from container 5432; NOT 5432 on the host
Database: employee_safety
User:     user
Password: password
```

### What runs automatically

- **Migrations:** `alembic upgrade head` runs inside the backend container on startup.
- **Demo seed:** if the `users` table is **empty**, startup inserts demo departments, users, events, and sample responses once.

### Stop / reset

```bash
docker compose down
```

Delete DB data (destructive):

```bash
docker compose down -v
```

---

## Path B — Vite + Docker Postgres/Redis + local FastAPI (recommended for frontend dev)

Use this when you want hot reload and faster iteration. **Do not** run the Docker **frontend** container at the same time — it also binds port **3000**, same as Vite.

1. **Stop** the compose frontend if it was running: `docker compose stop frontend` (or only start DB services — step 2).

2. **Start only Postgres and Redis:**

```bash
docker compose up -d postgres redis
```

Wait until Postgres is ready (a few seconds). Confirm: `docker compose ps` shows `postgres` healthy.

3. **Backend** (new terminal, always from **`backend/`** — Alembic and `app` imports assume this directory):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Default DATABASE_URL uses localhost:15432 → Docker Postgres from root compose

alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

4. **Frontend** (another terminal):

```bash
cd frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** (Vite).  
The dev server **proxies `/api` → `http://127.0.0.1:8000`**, so leave **`VITE_API_URL` unset** unless you intentionally want the browser to talk to the API directly.

Optional `frontend/.env`:

```env
# Leave empty for dev proxy (recommended):
# VITE_API_URL=

# Or point at the API explicitly:
# VITE_API_URL=http://127.0.0.1:8000
```

Never set `VITE_API_URL` to `.../api` — paths already include `/api/...`.

### Verify (hybrid)

- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) — OpenAPI
- [http://127.0.0.1:8000/api/departments](http://127.0.0.1:8000/api/departments) — should return `200`
- App at `http://localhost:3000` should load catalog without console `404` on `/api/*`

---

## Database URLs (reference)

**Host machine → Docker Postgres** (from `docker-compose.yml`):

```text
postgresql+psycopg://user:password@127.0.0.1:15432/employee_safety
```

**Container → Postgres** (hostname `postgres`, port `5432`):

```text
postgresql+psycopg://user:password@postgres:5432/employee_safety
```

---

## Authentication (quick reference)

| Flow | Notes |
|------|--------|
| **Demo role login** (“Login with demo role”) | Uses seeded user IDs — **no password** stored for those users |
| **Email + password** | Register via **Create account** on the login screen |

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| **`bind: address already in use` on port 3000** | Stop the Docker frontend (`docker compose stop frontend`) or stop another process on 3000. For Vite use another port: `npm run dev -- --port 5173`. |
| **`connection refused` to Postgres** | Use port **15432** on the host when connecting to Docker Postgres. Ensure `docker compose ps` shows `postgres` running/healthy. |
| **`404` on `/api/departments` etc.** | API must be **`backend/app`** (`cd backend && uvicorn ...`). From Docker: `docker compose up --build -d backend`. Do **not** run the legacy FastAPI app from the repo root `app/` package for this stack. |
| **`ModuleNotFoundError` / wrong routes** | Run `uvicorn` and `alembic` only inside **`backend/`**. |
| **Stale UI** | PWA service worker: hard refresh or DevTools → Application → Service Workers → Unregister. |

---

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React + TypeScript + Vite + PWA |
| `backend/` | FastAPI, SQLAlchemy, Alembic, `/api/...` portal routes |
| `docker-compose.yml` | Postgres, Redis, backend, frontend |
| `app/` at repo root | Legacy / experimental — **not** the Postgres-backed API entrypoint for this project |

---

## Running tests

Tests run inside the Docker backend container against a separate `employee_safety_test` database (automatically created on first startup).

**Prerequisites:** make sure the full stack is running:

```bash
docker compose up -d
```

**Run all tests:**

```bash
docker compose exec backend pytest
```

**Common options:**

```bash
docker compose exec backend pytest tests/test_jwt.py        # single file
docker compose exec backend pytest -x                        # stop on first failure
docker compose exec backend pytest -s                        # show print / log output
docker compose exec backend pytest -v                        # verbose (default)
```

**What is tested:**

| File | Coverage |
|------|----------|
| `tests/test_jwt.py` | JWT token creation and validation (unit, no DB) |
| `tests/test_auth.py` | `POST /api/auth/register`, `POST /api/auth/login` |
| `tests/test_reports.py` | `POST /api/reports`, `GET /api/reports/me` |
| `tests/test_reminders.py` | `POST /api/events/{id}/reminders` (supervisor role, idempotency) |
| `tests/test_notifications.py` | `GET /api/notifications/me` |

> **Isolation:** each test truncates all tables before running. The test database (`employee_safety_test`) is fully separate from the development database (`employee_safety`) — running tests never affects your local data.

---

## Useful commands

```bash
# SPA production build
cd frontend && npm run build

# Inspect registered routes (from backend venv, cwd = backend)
cd backend && python -c "from app.main import app; print([getattr(r,'path',r) for r in app.routes])"
```

---

## License

See repository metadata / team policy.
