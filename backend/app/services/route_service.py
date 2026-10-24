from datetime import datetime, date, time as dt_time, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.planning import (
    get_operational_planning_date,
    get_planning_date_bounds,
    normalize_to_business_date,
)
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import (
    DriverStatus,
    PickupStatus,
    RouteStatus,
    RouteStopType,
    VehicleStatus,
)
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.services.audit_service import log_operational_audit
from app.services.notification_events import notify_driver_assigned



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
            joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
            joinedload(Route.stops).joinedload(RouteStop.warehouse),
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
    active_only: bool = False,
    history_only: bool = False,
    planning_date: date | None = None,
):
    query = (
        db.query(Route)
        .options(
            joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
            joinedload(Route.stops).joinedload(RouteStop.warehouse),
            joinedload(Route.warehouse),
            joinedload(Route.driver),
            joinedload(Route.vehicle),
        )
    )

    if status_filter:
        query = query.filter(Route.status == status_filter)
    elif active_only:
        # Current active operations
        query = query.filter(
            Route.status.in_([
                RouteStatus.DRAFT,
                RouteStatus.READY,
                RouteStatus.ASSIGNED,
                RouteStatus.IN_PROGRESS,
            ])
        )
    elif history_only:
        # Completed / cancelled history
        query = query.filter(
            Route.status.in_([
                RouteStatus.COMPLETED,
                RouteStatus.CANCELLED,
            ])
        )

    if planning_date:
        start, end = get_planning_date_bounds(planning_date)
        query = query.filter(Route.route_date >= start, Route.route_date < end)

    return (
        query
        .order_by(Route.route_date.desc(), Route.id.desc())
        .all()
    )


def approve_route(
    db: Session,
    route_id: int,
    actor: User | None = None,
    current_user: User | None = None,
) -> Route:
    actor = actor or current_user
    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    if route.status != RouteStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only DRAFT routes can be approved. Current status is {route.status.value}.",
        )

    # Revalidate route stops and pickup eligibility
    pickup_stops = [s for s in route.stops if s.stop_type == RouteStopType.PICKUP and s.pickup_id]
    if not pickup_stops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route contains no pickup stops and cannot be approved.",
        )

    for stop in pickup_stops:
        pickup = stop.pickup or db.query(Pickup).filter(Pickup.id == stop.pickup_id).first()
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pickup #{stop.pickup_id} not found.",
            )
        if pickup.status != PickupStatus.SCHEDULED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pickup {pickup.pickup_code} is in {pickup.status.value} status and cannot be approved.",
            )
        # Ensure not in another active route
        other_active_stop = (
            db.query(RouteStop)
            .join(Route, Route.id == RouteStop.route_id)
            .filter(
                RouteStop.pickup_id == pickup.id,
                RouteStop.route_id != route.id,
                Route.status != RouteStatus.CANCELLED,
            )
            .first()
        )
        if other_active_stop:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pickup {pickup.pickup_code} is already allocated to another active route (#{other_active_stop.route_id}).",
            )

    now = datetime.now(timezone.utc)
    route.approved_at = now
    route.approved_by_id = actor.id if actor else None

    # If this route is part of an OptimizationRun and all its non-cancelled routes are now approved, update run status
    if route.optimization_run_id:
        unapproved_count = (
            db.query(Route)
            .filter(
                Route.optimization_run_id == route.optimization_run_id,
                Route.approved_at.is_(None),
                Route.id != route.id,
                Route.status != RouteStatus.CANCELLED,
            )
            .count()
        )
        if unapproved_count == 0:
            from app.models.optimization_run import OptimizationRun
            db.query(OptimizationRun).filter(
                OptimizationRun.id == route.optimization_run_id
            ).update({"status": "APPROVED"}, synchronize_session=False)

    log_operational_audit(
        db=db,
        action="ROUTE_APPROVED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "approved_at": now.isoformat(),
            "route_code": route.route_code,
        },
    )

    db.commit()
    return get_route(db, route.id)


def bulk_approve_routes(
    db: Session,
    route_ids: list[int],
    actor: User | None = None,
    current_user: User | None = None,
) -> dict:
    actor = actor or current_user
    approved_count = 0
    failed_count = 0
    results = []

    for route_id in route_ids:
        try:
            approve_route(db, route_id, actor=actor)
            approved_count += 1
            results.append({
                "route_id": route_id,
                "success": True,
                "error": None,
            })
        except HTTPException as exc:
            db.rollback()
            failed_count += 1
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            results.append({
                "route_id": route_id,
                "success": False,
                "error": detail,
            })
        except Exception as exc:
            db.rollback()
            failed_count += 1
            results.append({
                "route_id": route_id,
                "success": False,
                "error": str(exc),
            })

    return {
        "approved_count": approved_count,
        "failed_count": failed_count,
        "results": results,
    }


def reject_route(
    db: Session,
    route_id: int,
    reason: str | None = None,
    actor: User | None = None,
    current_user: User | None = None,
) -> dict:
    actor = actor or current_user
    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    if route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject a route in {route.status.value} status.",
        )

    route_code = route.route_code
    opt_run_id = route.optimization_run_id

    # Delete stops to release pickups back to planning
    db.query(RouteStop).filter(RouteStop.route_id == route_id).delete(synchronize_session=False)

    route.status = RouteStatus.CANCELLED
    route.approved_at = None
    route.approved_by_id = None
    route.driver_id = None
    route.vehicle_id = None

    if opt_run_id:
        from app.models.optimization_run import OptimizationRun
        db.query(OptimizationRun).filter(OptimizationRun.id == opt_run_id).update({"status": "DRAFT"}, synchronize_session=False)

    log_operational_audit(
        db=db,
        action="ROUTE_REJECTED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={"reason": reason or "Rejected by administrator during route review", "route_code": route_code},
    )

    db.commit()
    return {"message": f"Route {route_code} rejected and cancelled.", "route_id": route_id}


def _day_bounds(route_date: datetime):
    tz = route_date.tzinfo or timezone.utc
    start = datetime.combine(route_date.date(), dt_time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


def assign_route_fleet(
    db: Session,
    route_id: int,
    driver_id: int | None = None,
    vehicle_id: int | None = None,
    notes: str | None = None,
    actor: User | None = None,
    request: object | None = None,
    current_user: User | None = None,
) -> Route:
    actor = actor or current_user
    if request is not None:
        driver_id = getattr(request, "driver_id", driver_id)
        vehicle_id = getattr(request, "vehicle_id", vehicle_id)
        notes = getattr(request, "notes", notes)

    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    # Enforce Linear Workflow: Route must be reviewed and approved first!
    if route.approved_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route must be approved before assigning fleet. Review and approve the route first.",
        )

    if route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign driver or vehicle to a route in {route.status.value} status.",
        )

    # Validate Driver
    driver = (
        db.query(Driver)
        .filter(Driver.id == driver_id)
        .with_for_update()
        .first()
    )
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )
    if driver.status != DriverStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver is not active (status: {driver.status.value}).",
        )
    if driver.license_expiry and driver.license_expiry < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver license expired on {driver.license_expiry}.",
        )

    # Check driver overlapping assignment on the same day
    day_start, day_end = _day_bounds(route.route_date)
    conflicting_driver_route = (
        db.query(Route)
        .filter(
            Route.id != route.id,
            Route.driver_id == driver.id,
            Route.status.in_([RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]),
            Route.route_date >= day_start,
            Route.route_date < day_end,
        )
        .first()
    )
    if conflicting_driver_route:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Driver #{driver.id} is already committed to route {conflicting_driver_route.route_code} on this date.",
        )

    # Validate Vehicle
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id)
        .with_for_update()
        .first()
    )
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    if vehicle.status in [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle is not available (status: {vehicle.status.value}).",
        )

    # Check vehicle overlapping assignment on the same day
    conflicting_vehicle_route = (
        db.query(Route)
        .filter(
            Route.id != route.id,
            Route.vehicle_id == vehicle.id,
            Route.status.in_([RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]),
            Route.route_date >= day_start,
            Route.route_date < day_end,
        )
        .first()
    )
    if conflicting_vehicle_route:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vehicle #{vehicle.id} is already committed to route {conflicting_vehicle_route.route_code} on this date.",
        )

    # Check vehicle capacity satisfies route load
    route_load_kg = sum(
        float(stop.pickup.estimated_weight_kg or 0.0)
        for stop in route.stops
        if stop.pickup and stop.stop_type == RouteStopType.PICKUP
    )
    if vehicle.capacity_kg and float(vehicle.capacity_kg) < route_load_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle capacity ({vehicle.capacity_kg} kg) is insufficient for planned route load ({route_load_kg:.1f} kg).",
        )

    route.driver_id = driver.id
    route.vehicle_id = vehicle.id
    route.status = RouteStatus.READY

    log_operational_audit(
        db=db,
        action="FLEET_ASSIGNED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "driver_id": driver.id,
            "vehicle_id": vehicle.id,
            "route_code": route.route_code,
        },
    )

    db.commit()
    db.refresh(route)
    return get_route(db, route.id)


def dispatch_route(
    db: Session,
    route_id: int,
    actor: User | None = None,
    current_user: User | None = None,
) -> Route:
    actor = actor or current_user
    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    # Enforce Linear Workflow: Route must be approved before dispatch!
    if route.approved_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route has not been approved. Review and approve the route before dispatch.",
        )

    if not route.driver_id or not route.vehicle_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route must be assigned to both a driver and a vehicle before dispatch.",
        )

    if route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Route cannot be dispatched from {route.status.value} status.",
        )

    driver = db.query(Driver).filter(Driver.id == route.driver_id).with_for_update().first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).with_for_update().first()

    if not driver or driver.status != DriverStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned driver is inactive or unavailable.",
        )

    if not vehicle or vehicle.status in [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned vehicle is inactive or in maintenance.",
        )

    route.status = RouteStatus.IN_PROGRESS
    driver.is_available = False
    vehicle.status = VehicleStatus.ASSIGNED

    for stop in route.stops:
        if stop.pickup:
            stop.pickup.status = PickupStatus.ASSIGNED

    # Trigger notification
    try:
        notify_driver_assigned(
            db,
            driver_user_id=driver.user_id,
            route_id=route.id,
            route_code=route.route_code,
        )
    except Exception:
        pass

    log_operational_audit(
        db=db,
        action="ROUTE_DISPATCHED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "route_code": route.route_code,
            "driver_id": driver.id,
            "vehicle_id": vehicle.id,
            "stops_count": len(route.stops),
        },
    )

    db.commit()
    db.refresh(route)
    return get_route(db, route.id)


def bulk_dispatch_routes(
    db: Session,
    route_ids: list[int],
    actor: User | None = None,
    current_user: User | None = None,
) -> dict:
    actor = actor or current_user
    results = []
    dispatched_count = 0
    failed_count = 0

    for route_id in route_ids:
        try:
            dispatch_route(db, route_id, actor=actor)
            dispatched_count += 1
            results.append({
                "route_id": route_id,
                "success": True,
                "status": "ASSIGNED",
                "error": None,
            })
        except HTTPException as exc:
            db.rollback()
            failed_count += 1
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            results.append({
                "route_id": route_id,
                "success": False,
                "status": "FAILED",
                "error": detail,
            })
        except Exception as exc:
            db.rollback()
            failed_count += 1
            results.append({
                "route_id": route_id,
                "success": False,
                "status": "FAILED",
                "error": str(exc),
            })

    return {
        "dispatched_count": dispatched_count,
        "failed_count": failed_count,
        "results": results,
    }


def release_pickup_from_draft(
    db: Session,
    route_id: int,
    pickup_id: int,
    actor: User | None = None,
    current_user: User | None = None,
    reason: str | None = None,
) -> dict:
    actor = actor or current_user
    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    if route.status != RouteStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot release pickup from a route with status {route.status.value}. Pickups can only be released from unassigned DRAFT routes.",
        )

    stop = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == route_id, RouteStop.pickup_id == pickup_id)
        .with_for_update()
        .first()
    )
    if not stop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pickup #{pickup_id} is not part of route {route.route_code}.",
        )

    db.delete(stop)
    db.flush()

    # Resequence remaining stops
    remaining_stops = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == route_id)
        .order_by(RouteStop.sequence_number.asc())
        .all()
    )
    pickup_stops = [s for s in remaining_stops if s.stop_type == RouteStopType.PICKUP]
    warehouse_stop = next((s for s in remaining_stops if s.stop_type == RouteStopType.WAREHOUSE), None)

    seq = 1
    for s in pickup_stops:
        s.sequence_number = seq
        seq += 1
    if warehouse_stop:
        warehouse_stop.sequence_number = seq

    if not pickup_stops:
        route.status = RouteStatus.CANCELLED

    # Reset pickup status to SCHEDULED
    pickup = db.query(Pickup).filter(Pickup.id == pickup_id).first()
    if pickup:
        pickup.status = PickupStatus.SCHEDULED

    log_operational_audit(
        db=db,
        action="PICKUP_RELEASED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "pickup_id": pickup_id,
            "pickup_code": pickup.pickup_code if pickup else None,
            "route_code": route.route_code,
            "remaining_pickups": len(pickup_stops),
            "reason": reason,
        },
    )

    db.commit()
    return {
        "success": True,
        "message": f"Pickup #{pickup_id} released successfully from route {route.route_code}.",
        "route_id": route.id,
        "route_status": route.status.value,
        "remaining_pickups": len(pickup_stops),
    }


def reassign_route_fleet(
    db: Session,
    route_id: int,
    driver_id: int | None = None,
    vehicle_id: int | None = None,
    actor: User | None = None,
    request: object | None = None,
    current_user: User | None = None,
    reason: str | None = None,
) -> Route:
    actor = actor or current_user
    if request is not None:
        driver_id = getattr(request, "driver_id", driver_id)
        vehicle_id = getattr(request, "vehicle_id", vehicle_id)
        reason = getattr(request, "reason", reason)

    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    if route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reassign fleet on a route in {route.status.value} status.",
        )

    old_driver_id = route.driver_id
    old_vehicle_id = route.vehicle_id

    # If route was already dispatched (ASSIGNED), release old driver and vehicle
    if old_driver_id and old_driver_id != driver_id:
        old_driver = db.query(Driver).filter(Driver.id == old_driver_id).first()
        if old_driver:
            old_driver.is_available = True
    if old_vehicle_id and old_vehicle_id != vehicle_id:
        old_vehicle = db.query(Vehicle).filter(Vehicle.id == old_vehicle_id).first()
        if old_vehicle and old_vehicle.status == VehicleStatus.ASSIGNED:
            old_vehicle.status = VehicleStatus.AVAILABLE

    # Validate new driver
    driver = db.query(Driver).filter(Driver.id == driver_id).with_for_update().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    if driver.status != DriverStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Driver is not active (status: {driver.status.value}).")
    if driver.license_expiry and driver.license_expiry < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Driver license expired on {driver.license_expiry}.")

    day_start, day_end = _day_bounds(route.route_date)
    conflicting_driver_route = (
        db.query(Route)
        .filter(
            Route.id != route.id,
            Route.driver_id == driver.id,
            Route.status.in_([RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]),
            Route.route_date >= day_start,
            Route.route_date < day_end,
        )
        .first()
    )
    if conflicting_driver_route:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Driver #{driver.id} is already committed to route {conflicting_driver_route.route_code} on this date.",
        )

    # Validate new vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).with_for_update().first()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    if vehicle.status in [VehicleStatus.MAINTENANCE, VehicleStatus.INACTIVE]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Vehicle is not available (status: {vehicle.status.value}).")

    conflicting_vehicle_route = (
        db.query(Route)
        .filter(
            Route.id != route.id,
            Route.vehicle_id == vehicle.id,
            Route.status.in_([RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]),
            Route.route_date >= day_start,
            Route.route_date < day_end,
        )
        .first()
    )
    if conflicting_vehicle_route:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vehicle #{vehicle.id} is already committed to route {conflicting_vehicle_route.route_code} on this date.",
        )

    route_load_kg = sum(
        float(stop.pickup.estimated_weight_kg or 0.0)
        for stop in route.stops
        if stop.pickup and stop.stop_type == RouteStopType.PICKUP
    )
    if vehicle.capacity_kg and float(vehicle.capacity_kg) < route_load_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle capacity ({vehicle.capacity_kg} kg) is insufficient for planned route load ({route_load_kg:.1f} kg).",
        )

    route.driver_id = driver.id
    route.vehicle_id = vehicle.id

    if route.status == RouteStatus.ASSIGNED:
        driver.is_available = False
        vehicle.status = VehicleStatus.ASSIGNED
        try:
            notify_driver_assigned(
                db,
                driver_user_id=driver.user_id,
                route_id=route.id,
                route_code=route.route_code,
            )
        except Exception:
            pass
    else:
        route.status = RouteStatus.READY

    log_operational_audit(
        db=db,
        action="FLEET_REASSIGNED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "previous_driver_id": old_driver_id,
            "new_driver_id": driver.id,
            "previous_vehicle_id": old_vehicle_id,
            "new_vehicle_id": vehicle.id,
            "route_code": route.route_code,
            "reason": reason,
        },
    )

    db.commit()
    db.refresh(route)
    return get_route(db, route.id)


def unassign_route_fleet(
    db: Session,
    route_id: int,
    actor: User | None = None,
    current_user: User | None = None,
    reason: str | None = None,
) -> Route:
    actor = actor or current_user
    route = (
        db.query(Route)
        .filter(Route.id == route_id)
        .with_for_update()
        .first()
    )
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found",
        )

    if route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot unassign fleet from a route in {route.status.value} status.",
        )

    old_driver_id = route.driver_id
    old_vehicle_id = route.vehicle_id

    if old_driver_id:
        driver = db.query(Driver).filter(Driver.id == old_driver_id).first()
        if driver:
            driver.is_available = True

    if old_vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == old_vehicle_id).first()
        if vehicle and vehicle.status == VehicleStatus.ASSIGNED:
            vehicle.status = VehicleStatus.AVAILABLE

    if route.status == RouteStatus.ASSIGNED:
        for stop in route.stops:
            if stop.pickup:
                stop.pickup.status = PickupStatus.SCHEDULED

    route.driver_id = None
    route.vehicle_id = None
    route.status = RouteStatus.DRAFT

    log_operational_audit(
        db=db,
        action="FLEET_UNASSIGNED",
        entity_type="ROUTE",
        entity_id=route.id,
        entity_code=route.route_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "previous_driver_id": old_driver_id,
            "previous_vehicle_id": old_vehicle_id,
            "route_code": route.route_code,
            "reason": reason,
        },
    )

    db.commit()
    db.refresh(route)
    return get_route(db, route.id)


def list_historical_routes(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    status_filter: str | None = None,
):
    query = (
        db.query(Route)
        .options(
            joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
            joinedload(Route.stops).joinedload(RouteStop.warehouse),
            joinedload(Route.warehouse),
            joinedload(Route.driver),
            joinedload(Route.vehicle),
        )
    )

    if status_filter:
        try:
            enum_status = RouteStatus(status_filter)
            query = query.filter(Route.status == enum_status)
        except ValueError:
            pass
    else:
        query = query.filter(Route.status.in_([RouteStatus.COMPLETED, RouteStatus.CANCELLED]))

    if start_date:
        s_dt, _ = get_planning_date_bounds(start_date)
        query = query.filter(Route.route_date >= s_dt)
    if end_date:
        _, e_dt = get_planning_date_bounds(end_date)
        query = query.filter(Route.route_date < e_dt)

    return query.order_by(Route.route_date.desc(), Route.id.desc()).all()
