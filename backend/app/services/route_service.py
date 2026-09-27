from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.enums import PickupStatus, RouteStatus, RouteStopType
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.warehouse import Warehouse


def generate_route_code(route_date: datetime) -> str:
    date_part = route_date.strftime("%Y%m%d")
    random_part = uuid4().hex[:6].upper()

    return f"RT-{date_part}-{random_part}"


def create_route(
    db: Session,
    warehouse_id: int,
    route_date: datetime,
    pickup_ids: list[int],
) -> Route:

    # ------------------------------------------------------------
    # Validate duplicate pickup IDs
    # ------------------------------------------------------------
    if len(pickup_ids) != len(set(pickup_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate pickup IDs are not allowed",
        )

    # ------------------------------------------------------------
    # Get and lock warehouse
    # ------------------------------------------------------------
    warehouse = (
        db.query(Warehouse)
        .filter(Warehouse.id == warehouse_id)
        .with_for_update()
        .first()
    )

    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Warehouse not found",
        )

    if not warehouse.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warehouse is inactive",
        )

    # ------------------------------------------------------------
    # Get and lock pickups
    # ------------------------------------------------------------
    pickups = (
        db.query(Pickup)
        .filter(Pickup.id.in_(pickup_ids))
        .with_for_update()
        .all()
    )

    if len(pickups) != len(pickup_ids):
        found_ids = {pickup.id for pickup in pickups}
        missing_ids = [
            pickup_id
            for pickup_id in pickup_ids
            if pickup_id not in found_ids
        ]

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pickup(s) not found: {missing_ids}",
        )

    # ------------------------------------------------------------
    # Validate every pickup
    # ------------------------------------------------------------
    pickup_map = {pickup.id: pickup for pickup in pickups}

    for pickup_id in pickup_ids:
        pickup = pickup_map[pickup_id]

        if pickup.status != PickupStatus.SCHEDULED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pickup {pickup.pickup_code} must be "
                    f"SCHEDULED before adding it to a route"
                ),
            )

        if not pickup.scheduled_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pickup {pickup.pickup_code} does not have "
                    f"a scheduled date"
                ),
            )

        # The route date and pickup scheduled date must match.
        if pickup.scheduled_date.date() != route_date.date():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Pickup {pickup.pickup_code} is scheduled for "
                    f"{pickup.scheduled_date.date()}, while the route "
                    f"is for {route_date.date()}"
                ),
            )

        # A pickup can only belong to one route.
        existing_stop = (
            db.query(RouteStop)
            .filter(RouteStop.pickup_id == pickup.id)
            .first()
        )

        if existing_stop:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Pickup {pickup.pickup_code} is already "
                    f"assigned to route ID {existing_stop.route_id}"
                ),
            )

    # ------------------------------------------------------------
    # Create route
    # ------------------------------------------------------------
    route = Route(
        route_code=generate_route_code(route_date),
        route_date=route_date,
        warehouse_id=warehouse.id,
        status=RouteStatus.DRAFT,
    )

    db.add(route)
    db.flush()

    # ------------------------------------------------------------
    # Create pickup stops in supplied order
    # ------------------------------------------------------------
    sequence = 1

    for pickup_id in pickup_ids:
        stop = RouteStop(
            route_id=route.id,
            sequence_number=sequence,
            stop_type=RouteStopType.PICKUP,
            pickup_id=pickup_id,
        )

        db.add(stop)
        sequence += 1

    # ------------------------------------------------------------
    # Warehouse MUST be the final stop
    # ------------------------------------------------------------
    warehouse_stop = RouteStop(
        route_id=route.id,
        sequence_number=sequence,
        stop_type=RouteStopType.WAREHOUSE,
        warehouse_id=warehouse.id,
    )

    db.add(warehouse_stop)

    db.commit()

    db.refresh(route)

    return route


def get_route(
    db: Session,
    route_id: int,
) -> Route:

    route = (
        db.query(Route)
        .options(
            joinedload(Route.stops),
            joinedload(Route.warehouse),
        )
        .filter(Route.id == route_id)
        .first()
    )

    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    return route


def list_routes(
    db: Session,
    status_filter: RouteStatus | None = None,
):
    query = (
        db.query(Route)
        .options(
            joinedload(Route.stops),
        )
    )

    if status_filter:
        query = query.filter(Route.status == status_filter)

    return (
        query
        .order_by(Route.route_date.desc())
        .all()
    )