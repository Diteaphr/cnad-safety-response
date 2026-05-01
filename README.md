# CNAD Safety Response System

Employee Safety & Response prototype for disaster-time status reporting.

This repository currently contains:
- a **frontend-first high-fidelity prototype** (React + TypeScript + PWA)
- a lightweight backend service (FastAPI)
- Docker-based local run setup

The focus is UX, role-based flows, and emergency response page behavior.

## What Is Implemented

### Frontend (prototype-first)
- Role-based demo login:
  - Employee
  - Supervisor
  - Admin
  - Multi-role (role selector page)
- Event-first flow (2-step) for all roles:
  1) choose event card
  2) enter event detail page/dashboard
- Employee flow:
  - event list with ongoing/closed filter
  - event detail + one-tap report (`I'm Safe` / `I Need Help`)
  - optional location/comment/file attachment
  - history page
- Supervisor flow:
  - event selection page
  - event-specific dashboard with KPIs, pie chart, filters, and employee list
  - reminder/export action buttons
- Admin flow:
  - event selection page
  - global dashboard sections (overview, ranking, alerts, pending queue)
  - event management page with template-style creation + activation confirmation
  - user/department management page
  - notification/reminder page (event-specific view)
- Responsive UI:
  - desktop sidebar
  - mobile bottom nav + mobile logout fallback

### Backend
- FastAPI app with basic health and mock-oriented endpoints.
- Frontend currently relies on mock frontend state for most interactions.
- Backend is retained for architecture direction and future integration.

## Project Structure

- `frontend/` React + TypeScript + Vite + PWA
- `app/` FastAPI backend source
- `docker-compose.yml` local multi-service stack
- `docs/` architecture and notes

## Quick Start (Recommended)

### Prerequisites
- Docker Desktop (running)
- Node.js 20+ (optional if running frontend outside Docker)

### Run with Docker
From repo root:

```bash
npm run dev
```

This starts containers for:
- frontend (`http://localhost:3000`)
- backend (`http://localhost:8000`)
- postgres (`localhost:5432`)
- redis (`localhost:6379`)
- pubsub emulator (`localhost:8085`)

### Stop

```bash
docker compose down
```

## Smooth Setup Tips (Important)

### 1) Port 5432 conflict
If startup fails with `address already in use` on `5432`, stop local postgres service first.

Typical Homebrew case:
```bash
brew services stop postgresql@15
```

### 2) PWA cache / old UI showing
Because frontend is a PWA, browser service worker may cache old assets.

If UI looks outdated after rebuild:
1. Hard refresh (`Cmd+Shift+R`)
2. If still stale: DevTools -> Application -> Service Workers -> Unregister
3. Clear site storage and reload

### 3) Rebuild only frontend
When CSS/TS changes are not reflected:

```bash
docker compose up --build -d frontend
```

## Local Frontend-Only Development (Optional)

If you prefer running frontend directly:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Build Check

Frontend production build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
python -m compileall app/main.py
```

## Demo Notes for Teammates

- This is a **prototype for system design/demo**.
- Most interactions are mock/state-driven to prioritize UX and role flows.
- Event cards are the entry point before dashboards/reporting pages.
- Employee reporting page is intentionally the most simplified, high-priority UX.

## Next Suggested Work

- Add route-based URLs using `react-router-dom` (instead of state-only view switching)
- Connect frontend pages to backend APIs progressively
- Add persistent storage and auth integration
- Expand charts/tables with real data pipeline
