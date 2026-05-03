from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, portal
from app.core.database import SessionLocal
from app.seeding.seed_demo import run_if_empty

app = FastAPI(title="Employee Safety & Response System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(portal.router)


@app.on_event("startup")
def _seed_demo_if_empty() -> None:
    """初次空庫時灌種子。**不**強制重置；強制清庫請用 scripts/dev_reseed_demo.py."""
    db = SessionLocal()
    try:
        run_if_empty(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "Employee Safety & Response System API",
        "docs": "/docs",
    }
