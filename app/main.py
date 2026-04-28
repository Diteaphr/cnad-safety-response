import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from app.core.config import settings
from app.core.database import get_db

app = FastAPI(title="Employee Safety & Response System")

# Setup CORS to allow requests from the frontend PWA (e.g. localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a global redis connections pool
redis_client = redis.from_url(settings.redis_url)

# Mount Frontend static files (the built React PWA)
FRONTEND_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

@app.on_event("shutdown")
async def shutdown_event():
    await redis_client.close()

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    health_status = {
        "status": "ok",
        "db": "unknown",
        "redis": "unknown",
        "pubsub": "unknown"
    }
    
    # Check Database
    try:
        await db.execute(text("SELECT 1"))
        health_status["db"] = "ok"
    except Exception as e:
        health_status["db"] = f"error: {str(e)}"
        health_status["status"] = "error"
        
    # Check Redis
    try:
        await redis_client.ping()
        health_status["redis"] = "ok"
    except Exception as e:
        health_status["redis"] = f"error: {str(e)}"
        health_status["status"] = "error"

    # Check Pub/Sub Emulator/Cloud Connectivity
    try:
        from app.core.pubsub import publisher
        project_path = f"projects/{settings.project_id}"
        # list topics request to check connectivity
        topics = list(publisher.list_topics(request={"project": project_path}))
        health_status["pubsub"] = "ok"
    except Exception as e:
        health_status["pubsub"] = f"error: {str(e)}"
        health_status["status"] = "error"
        
    return health_status

@app.get("/")
async def root():
    return {"message": "Welcome to the Employee Safety & Response System API - API is healthy"}

from pydantic import BaseModel
from typing import Optional

class ReportPayload(BaseModel):
    event_id: int
    user_id: int
    status: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    comment: Optional[str] = None

@app.post("/reports")
async def create_report(payload: ReportPayload, db: AsyncSession = Depends(get_db)):
    # This is a temporary endpoint to handle frontend requests.
    # In a full implementation, it should save to the 'safety_responses' table and publish to Pub/Sub.
    return {"status": "success", "message": "Report received successfully.", "data": payload.dict()}

