from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.core.config import settings
from app.core.database import test_database_connection
from app.api.customers import router as customers_router
from app.api.customer_documents import router as customer_documents_router
from app.api.driver_vehicle import router as driver_vehicle_router
from app.api.drivers import router as drivers_router
from app.api.vehicles import router as vehicles_router
from app.api.pickups import router as pickups_router
from app.api.admin_pickups import router as admin_pickups_router


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
app.include_router(customers_router)
app.include_router(customer_documents_router)
app.include_router(driver_vehicle_router)
app.include_router(drivers_router)
app.include_router(vehicles_router)
app.include_router(pickups_router)
app.include_router(admin_pickups_router)

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