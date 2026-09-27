from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.core.config import settings
from app.core.database import test_database_connection


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
)


origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "pharmatrix-backend",
    }


@app.get("/health/db")
def database_health():
    connected = test_database_connection()

    return {
        "database": "connected" if connected else "failed"
    }