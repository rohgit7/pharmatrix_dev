from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models.driver import Driver
from app.models.enums import RouteStatus
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User


def get_driver_for_user(
    db: Session,
    user: User,
) -> Driver:
    driver = (
        db.query(Driver)
        .filter(Driver.user_id == user.id)
        .first()
    )

    if not driver:
        raise HTTPException(
            status_code=404,
            detail="Driver profile not found",
        )

    return driver


def get_driver_route_for_date(
    db: Session,
    user: User,
    route_date: date,
):
    driver = get_driver_for_user(db, user)

    start = datetime.combine(
        route_date,
        time.min,
        tzinfo=timezone.utc,
    )

    end = start + timedelta(days=1)

    route = (
        db.query(Route)
        .options(
            selectinload(Route.stops)
            .selectinload(RouteStop.pickup)
            .selectinload(Pickup.location),

            selectinload(Route.stops)
            .selectinload(RouteStop.warehouse),

            selectinload(Route.vehicle),
            selectinload(Route.warehouse),
        )
        .filter(
            Route.driver_id == driver.id,
            Route.route_date >= start,
            Route.route_date < end,
            Route.status.in_(
                [
                    RouteStatus.READY,
                    RouteStatus.ASSIGNED,
                    RouteStatus.IN_PROGRESS,
                ]
            ),
        )
        .order_by(Route.route_date.asc())
        .first()
    )

    if route:
        return route

    # Fallback: Check if driver has an active uncompleted route from recent days
    return (
        db.query(Route)
        .options(
            selectinload(Route.stops)
            .selectinload(RouteStop.pickup)
            .selectinload(Pickup.location),

            selectinload(Route.stops)
            .selectinload(RouteStop.warehouse),

            selectinload(Route.vehicle),
            selectinload(Route.warehouse),
        )
        .filter(
            Route.driver_id == driver.id,
            Route.status.in_(
                [
                    RouteStatus.READY,
                    RouteStatus.ASSIGNED,
                    RouteStatus.IN_PROGRESS,
                ]
            ),
        )
        .order_by(Route.route_date.desc())
        .first()
    )