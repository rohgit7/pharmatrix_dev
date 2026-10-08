from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.enums import (
    PickupStatus,
    RouteStatus,
    WarehouseIntakeStatus,
    OperationalExceptionStatus,
)
from app.models.operational_exception import OperationalException
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.warehouse_intake import WarehouseIntake


def get_admin_dashboard_summary(db: Session) -> dict:
    now = datetime.now(timezone.utc)

    start_of_day = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    end_of_day = start_of_day.replace(
        hour=23,
        minute=59,
        second=59,
        microsecond=999999,
    )

    total_pickups = (
        db.query(func.count(Pickup.id))
        .scalar()
        or 0
    )

    pending_pickups = (
        db.query(func.count(Pickup.id))
        .filter(
            Pickup.status.in_(
                [
                    PickupStatus.REQUESTED,
                    PickupStatus.SCHEDULED,
                ]
            )
        )
        .scalar()
        or 0
    )

    today_scheduled_pickups = (
        db.query(func.count(Pickup.id))
        .filter(
            Pickup.scheduled_date >= start_of_day,
            Pickup.scheduled_date <= end_of_day,
        )
        .scalar()
        or 0
    )

    active_routes = (
        db.query(func.count(Route.id))
        .filter(
            Route.status.in_(
                [
                    RouteStatus.ASSIGNED,
                    RouteStatus.IN_PROGRESS,
                ]
            )
        )
        .scalar()
        or 0
    )

    pending_warehouse_intakes = (
        db.query(func.count(WarehouseIntake.id))
        .filter(
            WarehouseIntake.status
            == WarehouseIntakeStatus.PENDING
        )
        .scalar()
        or 0
    )

    open_exceptions = (
        db.query(func.count(OperationalException.id))
        .filter(
            OperationalException.status
            == OperationalExceptionStatus.OPEN
        )
        .scalar()
        or 0
    )

    total_collected_weight = (
        db.query(
            func.coalesce(
                func.sum(RouteStop.collected_weight_kg),
                0,
            )
        )
        .scalar()
        or 0
    )

    return {
        "total_pickups": total_pickups,
        "pending_pickups": pending_pickups,
        "today_scheduled_pickups": today_scheduled_pickups,
        "active_routes": active_routes,
        "pending_warehouse_intakes": pending_warehouse_intakes,
        "open_exceptions": open_exceptions,
        "total_collected_weight_kg": float(
            total_collected_weight
        ),
    }