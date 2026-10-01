from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from contextlib import asynccontextmanager
from app.api.admin_exceptions import (
    router as admin_exceptions_router,
)
from app.services.configuration_runtime_service import (
    get_configuration_bool,
)
from app.services.notification_worker import (
    process_pending_notifications,
)
from app.services.configuration_activation_service import (
    activate_due_configuration_versions,
)
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
from app.services.operational_exception_service import (
    process_exception_escalations,
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

from app.services.pickup_reminder_service import (
    process_pickup_reminders,
)

async def notification_worker_loop(
    stop_event: asyncio.Event,
):
    reminder_check_interval = 60
    exception_check_interval = 60
    configuration_activation_interval = 10

    seconds_since_reminder_check = reminder_check_interval
    seconds_since_exception_check = exception_check_interval
    seconds_since_configuration_activation = (
        configuration_activation_interval
    )

    while not stop_event.is_set():

        # -----------------------------------------
        # Notification delivery
        # -----------------------------------------

        try:
            from app.core.database import SessionLocal

            db = SessionLocal()

            try:
                worker_enabled = get_configuration_bool(
                    db,
                    "notifications.worker_enabled",
                )
            finally:
                db.close()

            if worker_enabled:
                await asyncio.to_thread(
                    process_pending_notifications,
                    batch_size=10,
                )

        except Exception as exc:
            print(
                f"[notification-worker] {exc}"
            )

        # -----------------------------------------
        # Pickup reminders
        # -----------------------------------------

        if seconds_since_reminder_check >= reminder_check_interval:

            try:
                await asyncio.to_thread(
                    process_pickup_reminders,
                )

            except Exception as exc:
                print(
                    f"[pickup-reminder] {exc}"
                )

            finally:
                seconds_since_reminder_check = 0

        # -----------------------------------------
        # Exception escalation
        # -----------------------------------------

        if seconds_since_exception_check >= exception_check_interval:

            try:
                await asyncio.to_thread(
                    process_exception_escalations,
                )

            except Exception as exc:
                print(
                    f"[exception-escalation] {exc}"
                )

            finally:
                seconds_since_exception_check = 0

        # -----------------------------------------
        # Configuration version activation
        # -----------------------------------------

        if (
            seconds_since_configuration_activation
            >= configuration_activation_interval
        ):

            try:
                from app.core.database import SessionLocal

                db = SessionLocal()

                try:
                    activated_count = (
                        activate_due_configuration_versions(
                            db
                        )
                    )

                    if activated_count:
                        db.commit()

                except Exception as exc:
                    db.rollback()
                    print(
                        f"[configuration-activation] {exc}"
                    )

                finally:
                    db.close()

            except Exception as exc:
                print(
                    f"[configuration-activation] {exc}"
                )

            finally:
                seconds_since_configuration_activation = 0

        # -----------------------------------------
        # Wait
        # -----------------------------------------

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=10,
            )
        except asyncio.TimeoutError:
            pass

        seconds_since_reminder_check += 10
        seconds_since_exception_check += 10


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()

    worker_task = asyncio.create_task(
        notification_worker_loop(stop_event)
    )

    try:
        yield

    finally:
        stop_event.set()

        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
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
    admin_configuration_router
)
app.include_router(admin_exceptions_router)
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