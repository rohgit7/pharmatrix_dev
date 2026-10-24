from __future__ import annotations

from datetime import date, datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.planning import (
    BUSINESS_TIMEZONE_STR,
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
    VehicleStatus,
)
from app.models.optimization_run import OptimizationRun
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.vehicle import Vehicle
from app.services.configuration_runtime_service import get_configuration_float


def get_next_day_planning_readiness(
    db: Session,
    warehouse_id: int | None = None,
    target_date: date | None = None,
) -> dict:
    """
    Computes an authoritative, non-overlapping readiness summary for the next-day
    operating cycle in Asia/Kolkata timezone.
    """
    planning_date = target_date or get_operational_planning_date()
    day_start, day_end = get_planning_date_bounds(planning_date)

    try:
        max_pickup_weight_kg = (
            get_configuration_float(db, "operations.max_pickup_weight_kg") or 70.0
        )
    except Exception:
        max_pickup_weight_kg = 70.0

    # 1. Fetch all pickups scheduled or requested for tomorrow
    pickups = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.location),
            joinedload(Pickup.customer),
        )
        .filter(
            (
                (Pickup.scheduled_date >= day_start) & (Pickup.scheduled_date < day_end)
            )
            | (
                (Pickup.scheduled_date.is_(None))
                & (Pickup.requested_date >= day_start)
                & (Pickup.requested_date < day_end)
            )
        )
        .all()
    )

    # Also fetch all RouteStops on non-cancelled routes for tomorrow
    route_query = db.query(Route).filter(
        Route.route_date >= day_start,
        Route.route_date < day_end,
        Route.status != RouteStatus.CANCELLED,
    )
    if warehouse_id is not None:
        route_query = route_query.filter(Route.warehouse_id == warehouse_id)

    day_routes = route_query.all()
    day_route_ids = {r.id for r in day_routes}

    active_route_stops = (
        db.query(RouteStop)
        .filter(
            RouteStop.route_id.in_(day_route_ids),
            RouteStop.pickup_id.is_not(None),
        )
        .all()
        if day_route_ids
        else []
    )
    pickup_to_route_stop = {s.pickup_id: s for s in active_route_stops}

    # Group pickups without overlap
    eligible_awaiting_selection = []
    allocated_to_routes = []
    pickups_excluded = []

    total_demand_kg = 0.0

    for p in pickups:
        weight = float(p.estimated_weight_kg or 0.0)
        total_demand_kg += weight

        # Check if already in an active route stop
        if p.id in pickup_to_route_stop:
            allocated_to_routes.append(p)
            continue

        # Check eligibility
        if p.status != PickupStatus.SCHEDULED:
            reason = (
                f"Pickup status is {p.status.value}; must be SCHEDULED for route planning."
                if p.status == PickupStatus.REQUESTED
                else f"Pickup is in {p.status.value} status."
            )
            pickups_excluded.append({
                "pickup_id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "customer_name": p.customer.display_name if p.customer else None,
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
                "reason": reason,
            })
            continue

        if not p.location:
            pickups_excluded.append({
                "pickup_id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "customer_name": p.customer.display_name if p.customer else None,
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
                "reason": "Customer location record is missing.",
            })
            continue

        if p.location.latitude is None or p.location.longitude is None:
            pickups_excluded.append({
                "pickup_id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "customer_name": p.customer.display_name if p.customer else None,
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
                "reason": "Pickup location coordinates are missing or invalid.",
            })
            continue

        if not p.location.pickup_enabled:
            pickups_excluded.append({
                "pickup_id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "customer_name": p.customer.display_name if p.customer else None,
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
                "reason": "Pickup is disabled for this customer location.",
            })
            continue

        if weight > max_pickup_weight_kg:
            pickups_excluded.append({
                "pickup_id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "customer_name": p.customer.display_name if p.customer else None,
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
                "reason": f"Estimated weight ({weight} kg) exceeds maximum limit of {max_pickup_weight_kg} kg.",
            })
            continue

        # If eligible and not allocated
        eligible_awaiting_selection.append(p)

    # 2. Evaluate Routes awaiting review, assignment, dispatch
    routes_awaiting_review = 0
    routes_awaiting_assignment = 0
    routes_awaiting_dispatch = 0

    for r in day_routes:
        if r.status == RouteStatus.DRAFT and not r.approved_at:
            routes_awaiting_review += 1
        elif (r.approved_at or r.status == RouteStatus.DRAFT) and (not r.driver_id or not r.vehicle_id):
            routes_awaiting_assignment += 1
        elif r.status == RouteStatus.READY and r.driver_id and r.vehicle_id:
            routes_awaiting_dispatch += 1

    # 3. Available fleet capacity
    # Vehicles active and available, not in maintenance
    available_vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.status.notin_([
                VehicleStatus.MAINTENANCE,
                VehicleStatus.INACTIVE,
            ])
        )
        .all()
    )
    # Exclude vehicles already committed to active routes tomorrow
    committed_vehicle_ids = {
        r.vehicle_id for r in day_routes if r.vehicle_id and r.status in [RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]
    }
    uncommitted_vehicles = [
        v for v in available_vehicles if v.id not in committed_vehicle_ids
    ]
    available_fleet_capacity_kg = sum(float(v.capacity_kg or 0.0) for v in uncommitted_vehicles)

    # Unallocated demand
    unallocated_demand_kg = sum(float(p.estimated_weight_kg or 0.0) for p in eligible_awaiting_selection)
    capacity_shortfall_kg = max(0.0, unallocated_demand_kg - available_fleet_capacity_kg)

    # 4. Check for latest optimization run
    latest_run_record = (
        db.query(OptimizationRun)
        .filter(
            OptimizationRun.planning_date >= day_start,
            OptimizationRun.planning_date < day_end,
        )
        .order_by(OptimizationRun.created_at.desc())
        .first()
    )
    latest_run_summary = None
    if latest_run_record:
        latest_run_summary = {
            "run_id": latest_run_record.id,
            "run_code": latest_run_record.run_code,
            "status": latest_run_record.status,
            "routes_created": latest_run_record.routes_created,
            "pickups_assigned": latest_run_record.pickups_assigned,
            "unassigned_count": len(latest_run_record.unassigned_pickups or []),
            "created_at": latest_run_record.created_at.isoformat(),
        }

    # Blockers
    blockers = []
    if capacity_shortfall_kg > 0:
        blockers.append(
            f"Fleet capacity shortfall of {capacity_shortfall_kg:.1f} kg. Available vehicle capacity cannot carry tomorrow's demand."
        )
    if routes_awaiting_review > 0:
        blockers.append(
            f"{routes_awaiting_review} draft route(s) require review and approval before assignment."
        )
    if routes_awaiting_assignment > 0:
        blockers.append(
            f"{routes_awaiting_assignment} approved route(s) require driver and vehicle assignment."
        )

    is_ready = (
        len(eligible_awaiting_selection) == 0
        and routes_awaiting_review == 0
        and routes_awaiting_assignment == 0
        and routes_awaiting_dispatch > 0
    )

    return {
        "planning_date": planning_date.isoformat(),
        "timezone": BUSINESS_TIMEZONE_STR,
        "total_pickups_requested_tomorrow": len(pickups),
        "eligible_pickups_awaiting_selection": len(eligible_awaiting_selection),
        "pickups_allocated_to_routes": len(allocated_to_routes),
        "pickups_excluded_count": len(pickups_excluded),
        "pickups_excluded": pickups_excluded,
        "routes_awaiting_review": routes_awaiting_review,
        "routes_awaiting_assignment": routes_awaiting_assignment,
        "routes_awaiting_dispatch": routes_awaiting_dispatch,
        "total_demand_kg": round(total_demand_kg, 2),
        "available_fleet_capacity_kg": round(available_fleet_capacity_kg, 2),
        "capacity_shortfall_kg": round(capacity_shortfall_kg, 2),
        "is_ready_for_dispatch": is_ready,
        "blockers": blockers,
        "latest_run": latest_run_summary,
    }


# Backwards-compatible aliases
get_planning_readiness = get_next_day_planning_readiness
get_next_day_readiness = get_next_day_planning_readiness
