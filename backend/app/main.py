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
from app.api.admin_routes import router as admin_routes_router
from app.api.admin_warehouses import router as admin_warehouses_router
from app.api.admin_route_optimization import (
    router as admin_route_optimization_router,
)
from app.api.driver_routes import (
    router as driver_routes_router,
)
from app.api.driver_route_execution import (
    router as driver_route_execution_router,
)
from app.api.admin_collection_proofs import (
    router as admin_collection_proofs_router,
)
from app.api.admin_warehouse_intakes import (
    router as admin_warehouse_intakes_router,
)
from app.api.admin_facilities import (
    router as admin_facilities_router,
)
from app.api.facility import (
    router as facility_router,
)
from app.api.admin_disposal_shipments import router as admin_disposal_shipments_router
from app.api.facility_disposal_shipments import router as facility_disposal_shipments_router
from app.api.facility_disposal_certificates import (
    router as facility_disposal_certificates_router,
)
from app.api.customer_disposal import (
    router as customer_disposal_router,
)
from app.api.notifications import (
    router as notifications_router,
)
from app.api.whatsapp_webhooks import router as whatsapp_webhook_router

from app.api.admin_whatsapp_templates import (
    router as admin_whatsapp_templates_router,
)
from app.api.admin_configuration_changes import (
    router as admin_configuration_changes_router,
)
from app.api.admin_configuration_audit import (
    router as admin_configuration_audit_router,
)
from app.api.admin_configuration import (
    router as admin_configuration_router,
)


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
app.include_router(admin_routes_router)
app.include_router(admin_warehouses_router)
app.include_router(admin_route_optimization_router)
app.include_router(driver_routes_router)
app.include_router(driver_route_execution_router)
app.include_router(admin_collection_proofs_router)
app.include_router(admin_warehouse_intakes_router)
app.include_router(
    admin_facilities_router
)

app.include_router(
    facility_router
)
app.include_router(admin_disposal_shipments_router)
app.include_router(facility_disposal_shipments_router)
app.include_router(
    facility_disposal_certificates_router
)
app.include_router(customer_disposal_router)
app.include_router(
    notifications_router
)
app.include_router(whatsapp_webhook_router)
app.include_router(
    admin_whatsapp_templates_router
)
app.include_router(
    admin_configuration_changes_router
)
app.include_router(
    admin_configuration_audit_router
)
app.include_router(
    admin_configuration_changes_router
)

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