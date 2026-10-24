from __future__ import annotations

from collections import Counter
from datetime import date, datetime, time as dt_time, timedelta, timezone
from uuid import uuid4
from app.services.configuration_runtime_service import get_active_version
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.core.config import settings
from app.core.planning import (
    BUSINESS_TIMEZONE,
    BUSINESS_TIMEZONE_STR,
    get_operational_planning_date,
    get_planning_date_bounds,
    normalize_to_business_date,
    validate_is_operational_planning_date,
)
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import (
    DriverStatus,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    VehicleStatus,
)
from app.models.optimization_run import OptimizationRun, OptimizationRunPickup
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.optimizer import Config, HaversineProvider, OSRMProvider, Store, solve
from app.optimizer.problem import Problem
from app.services.audit_service import log_operational_audit
from app.services.notification_events import (
    notify_driver_assigned,
)
from app.services.configuration_runtime_service import (
    get_configuration_float,
)

def _route_code(route_date: datetime) -> str:
    p_date = normalize_to_business_date(route_date) or route_date.date()
    return f"RT-{p_date.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"


def _day_bounds(route_date: datetime):
    p_date = normalize_to_business_date(route_date)
    if p_date:
        return get_planning_date_bounds(p_date)
    tz = route_date.tzinfo or timezone.utc
    start = datetime.combine(route_date.date(), dt_time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


def _available_fleet(db: Session):
    return (
        db.query(DriverVehicleAssignment)
        .join(Driver, Driver.id == DriverVehicleAssignment.driver_id)
        .join(Vehicle, Vehicle.id == DriverVehicleAssignment.vehicle_id)
        .options(
            joinedload(DriverVehicleAssignment.driver),
            joinedload(DriverVehicleAssignment.vehicle),
        )
        .filter(
            DriverVehicleAssignment.unassigned_at.is_(None),
            Driver.status == DriverStatus.ACTIVE,
            Driver.is_available.is_(True),
            Vehicle.status.notin_(
                [
                    VehicleStatus.MAINTENANCE,
                    VehicleStatus.INACTIVE,
                ]
            ),
        )
        .order_by(DriverVehicleAssignment.id.asc())
        .all()
    )


def _scheduled_pickups(db: Session, route_date: datetime):
    start, end = _day_bounds(route_date)
    return (
        db.query(Pickup)
        .options(joinedload(Pickup.location))
        .filter(
            Pickup.status == PickupStatus.SCHEDULED,
            Pickup.scheduled_date >= start,
            Pickup.scheduled_date < end,
        )
        .order_by(Pickup.created_at.asc())
        .all()
    )


def _validate_optimizer_output(
    *,
    stores: list[Store],
    problem: Problem,
    optimized_routes: list[list[int]],
    uncovered: list[int],
    unreachable: list[int],
    vehicle_count: int,
) -> list[tuple[int, list[int]]]:
    """Validate the optimizer's zero-based pickup nodes and terminal depot."""
    invalid_result = "Route optimizer returned invalid output"

    try:
        problem_pickup_count = problem.n
        warehouse_node = problem.W
    except AttributeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": invalid_result,
                "reason": "Optimizer did not return a valid problem description.",
            },
        ) from exc

    if problem_pickup_count != len(stores) or warehouse_node != len(stores):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": invalid_result,
                "reason": "Optimizer problem node count does not match the pickup list.",
            },
        )

    if not isinstance(optimized_routes, (list, tuple)) or len(optimized_routes) != vehicle_count:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": invalid_result,
                "reason": (
                    "Optimizer must return exactly one route per available "
                    "driver-vehicle assignment."
                ),
            },
        )

    classified_nodes: list[int] = []
    validated_routes: list[tuple[int, list[int]]] = []

    def validate_classification(nodes, classification: str) -> list[int]:
        if not isinstance(nodes, (list, tuple)):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": f"Optimizer {classification} nodes must be a list.",
                },
            )
        validated_nodes = []
        for node in nodes:
            if isinstance(node, bool) or not isinstance(node, int) or not 0 <= node < len(stores):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "message": invalid_result,
                        "reason": (
                            f"Optimizer returned invalid {classification} pickup node "
                            f"{node!r}; pickup node indices must be between 0 and "
                            f"{len(stores) - 1}."
                        ),
                    },
                )
            validated_nodes.append(node)
        return validated_nodes

    for vehicle_index, route in enumerate(optimized_routes):
        if not isinstance(route, (list, tuple)) or not route:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": f"Route for vehicle index {vehicle_index} is empty.",
                },
            )
        if any(isinstance(node, bool) or not isinstance(node, int) for node in route):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": f"Route for vehicle index {vehicle_index} contains a non-integer node.",
                },
            )
        if route[-1] != warehouse_node:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": (
                        f"Route for vehicle index {vehicle_index} must end at "
                        f"warehouse node {warehouse_node}."
                    ),
                },
            )
        if problem.W in route[:-1]:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": (
                        f"Route for vehicle index {vehicle_index} contains the "
                        "warehouse node before its final stop."
                    ),
                },
            )

        pickup_nodes = validate_classification(route[:-1], "route")
        try:
            route_is_feasible = problem.ok(list(route), vehicle_index)
        except (AttributeError, IndexError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": (
                        f"Optimizer route for vehicle index {vehicle_index} "
                        f"could not be validated: {exc}"
                    ),
                },
            ) from exc
        if not route_is_feasible:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": invalid_result,
                    "reason": (
                        f"Optimizer returned a route for vehicle index "
                        f"{vehicle_index} that violates capacity, distance, "
                        "or duration constraints."
                    ),
                },
            )
        classified_nodes.extend(pickup_nodes)
        validated_routes.append((vehicle_index, pickup_nodes))

    uncovered_nodes = validate_classification(uncovered, "uncovered")
    unreachable_nodes = validate_classification(unreachable, "unreachable")
    classified_nodes.extend(uncovered_nodes)
    classified_nodes.extend(unreachable_nodes)

    if len(classified_nodes) != len(set(classified_nodes)):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": invalid_result,
                "reason": "Optimizer classified a pickup more than once.",
            },
        )

    missing_nodes = sorted(set(range(len(stores))) - set(classified_nodes))
    if missing_nodes:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": invalid_result,
                "reason": "Optimizer omitted one or more pickup nodes.",
                "pickup_node_indices": missing_nodes,
            },
        )

    return validated_routes


def _validate_route_inputs(
    route_inputs: list[dict],
    eligible_pickup_ids: set[int],
) -> None:
    assigned_pickup_ids = [
        pickup_id
        for route_input in route_inputs
        for pickup_id in route_input["pickup_ids"]
    ]
    assigned_pickup_id_set = set(assigned_pickup_ids)
    duplicate_pickup_ids = sorted(
        pickup_id
        for pickup_id, count in Counter(assigned_pickup_ids).items()
        if count > 1
    )
    if duplicate_pickup_ids:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Route optimizer returned duplicate pickup assignments",
                "pickup_ids": duplicate_pickup_ids,
            },
        )

    if assigned_pickup_id_set != eligible_pickup_ids:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Route optimizer assignments do not match eligible pickups",
                "missing_pickup_ids": sorted(eligible_pickup_ids - assigned_pickup_id_set),
                "unexpected_pickup_ids": sorted(assigned_pickup_id_set - eligible_pickup_ids),
            },
        )


def optimize_and_dispatch(
    db: Session,
    warehouse_id: int,
    route_date: datetime,
    batch_id: int | None = None,
    num_vehicles: int | None = None,
    vehicle_capacity_kg: float | None = None,
    max_distance_km: float | None = None,
    max_duration_minutes: float | None = None,
    service_time_minutes: float | None = None,
    local_backward_allowance_km: float | None = None,
    selected_pickup_ids: list[int] | None = None,
    auto_dispatch: bool = False,
    enforce_next_day: bool = False,
    rerun: bool = False,
    actor: User | None = None,
    current_user: User | None = None,
    user_id: int | None = None,
):
    actor = actor or current_user
    if not actor and user_id:
        actor = db.query(User).filter(User.id == user_id).first()
    if enforce_next_day:
        planning_date = validate_is_operational_planning_date(route_date, "Route optimization")
    else:
        planning_date = normalize_to_business_date(route_date) or route_date.date()

    p_start, p_end = get_planning_date_bounds(planning_date)

    warehouse = (
        db.query(Warehouse)
        .filter(Warehouse.id == warehouse_id)
        .first()
    )
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    if not warehouse.active:
        raise HTTPException(status_code=400, detail="Warehouse is inactive")

    fleet = _available_fleet(db)
    available_vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.status.notin_([
                VehicleStatus.MAINTENANCE,
                VehicleStatus.INACTIVE,
            ])
        )
        .order_by(Vehicle.id.asc())
        .all()
    )

    if fleet:
        fleet_to_use = fleet[:num_vehicles] if (num_vehicles and num_vehicles > 0) else fleet
    else:
        fleet_to_use = []

    opt_run = None
    target_pickup_ids = None

    if batch_id is not None:
        opt_run = (
            db.query(OptimizationRun)
            .filter(OptimizationRun.id == batch_id)
            .with_for_update()
            .first()
        )
        if not opt_run:
            raise HTTPException(status_code=404, detail=f"Optimization batch #{batch_id} not found.")
        target_pickup_ids = [sp.pickup_id for sp in opt_run.submitted_pickups]
        if not target_pickup_ids and opt_run.parameters and "pickup_ids" in opt_run.parameters:
            target_pickup_ids = opt_run.parameters["pickup_ids"]
    elif selected_pickup_ids is not None and len(selected_pickup_ids) > 0:
        target_pickup_ids = selected_pickup_ids
        opt_run = (
            db.query(OptimizationRun)
            .options(
                joinedload(OptimizationRun.submitted_pickups),
                joinedload(OptimizationRun.routes).joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
            )
            .filter(
                OptimizationRun.warehouse_id == warehouse.id,
                OptimizationRun.planning_date >= p_start,
                OptimizationRun.planning_date < p_end,
                OptimizationRun.status.in_(["SUBMITTED", "DRAFT", "OPTIMIZED"]),
            )
            .order_by(OptimizationRun.id.desc())
            .first()
        )
    else:
        # Check if an active submitted or draft batch exists for this warehouse and planning date
        opt_run = (
            db.query(OptimizationRun)
            .options(
                joinedload(OptimizationRun.submitted_pickups),
                joinedload(OptimizationRun.routes).joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
            )
            .filter(
                OptimizationRun.warehouse_id == warehouse.id,
                OptimizationRun.planning_date >= p_start,
                OptimizationRun.planning_date < p_end,
                OptimizationRun.status.in_(["SUBMITTED", "DRAFT", "OPTIMIZED"]),
            )
            .order_by(OptimizationRun.id.desc())
            .first()
        )
        if opt_run:
            target_pickup_ids = [sp.pickup_id for sp in opt_run.submitted_pickups]
            if not target_pickup_ids and opt_run.parameters and "pickup_ids" in opt_run.parameters:
                target_pickup_ids = opt_run.parameters["pickup_ids"]

    if not target_pickup_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No submitted optimization batch found. Pickups must be explicitly submitted from Pickup Planning before optimization.",
        )

    # Idempotency: If this batch was already optimized and rerun is false, return the existing routes
    if batch_id is not None and opt_run and opt_run.id and not rerun:
        existing_draft_routes = [
            r for r in opt_run.routes
            if r.status != RouteStatus.CANCELLED
        ]
        if existing_draft_routes:
            existing_summaries = []
            for r in existing_draft_routes:
                p_ids = [s.pickup_id for s in r.stops if s.stop_type == RouteStopType.PICKUP and s.pickup_id]
                stops_locs = []
                for s in r.stops:
                    if s.stop_type == RouteStopType.PICKUP and s.pickup and s.pickup.location:
                        loc = s.pickup.location
                        stops_locs.append({
                            "pickup_id": s.pickup.id,
                            "sequence_number": s.sequence_number,
                            "location_name": loc.name,
                            "lat": float(loc.latitude),
                            "lng": float(loc.longitude),
                            "estimated_weight_kg": float(s.pickup.estimated_weight_kg) if s.pickup.estimated_weight_kg is not None else 1.0,
                        })
                poly = [[float(warehouse.latitude), float(warehouse.longitude)]]
                for sl in stops_locs:
                    poly.append([sl["lat"], sl["lng"]])
                poly.append([float(warehouse.latitude), float(warehouse.longitude)])

                dist = float(r.planned_distance_km or 0.0)
                dur = round((r.planned_duration_seconds or 0) / 60.0, 1)
                load = sum(sl.get("estimated_weight_kg") or 0.0 for sl in stops_locs)

                existing_summaries.append({
                    "route_id": r.id,
                    "route_code": r.route_code,
                    "driver_id": r.driver_id,
                    "vehicle_id": r.vehicle_id,
                    "pickup_ids": p_ids,
                    "distance_km": dist,
                    "duration_minutes": dur,
                    "load_kg": round(load, 2),
                    "stop_locations": stops_locs,
                    "polyline": poly,
                    "backtrack_km": 0.0,
                    "status": r.status.value,
                    "is_approved": r.approved_at is not None,
                })

            total_dist = sum(s["distance_km"] for s in existing_summaries)
            max_d = max((s["duration_minutes"] for s in existing_summaries), default=0.0)
            return {
                "route_date": route_date,
                "planning_date": planning_date.isoformat(),
                "warehouse_id": warehouse_id,
                "warehouse_coordinates": [float(warehouse.latitude), float(warehouse.longitude)],
                "vehicles_available": len(fleet_to_use),
                "routes_created": len(existing_summaries),
                "pickups_assigned": sum(len(s["pickup_ids"]) for s in existing_summaries),
                "unassigned_pickups": [],
                "total_fleet_distance_km": round(total_dist, 2),
                "max_route_duration_minutes": round(max_d, 1),
                "vehicle_utilization_pct": 50.0,
                "cross_vehicle_overlap_km": 0.0,
                "routes": existing_summaries,
                "routing_source": "PERSISTED",
                "optimization_run_id": opt_run.id,
                "optimization_run_code": opt_run.run_code,
            }

    # Load and revalidate the submitted pickups
    pickups = (
        db.query(Pickup)
        .options(joinedload(Pickup.location))
        .filter(Pickup.id.in_(target_pickup_ids))
        .order_by(Pickup.created_at.asc())
        .all()
    )

    if len(pickups) != len(target_pickup_ids):
        found_ids = {p.id for p in pickups}
        missing_ids = sorted(set(target_pickup_ids) - found_ids)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pickup(s) not found: {missing_ids}",
        )

    # 1. Enforce date consistency: No mixed dates and must match planning_date
    mixed_date_pickups = []
    for p in pickups:
        p_date = normalize_to_business_date(p.scheduled_date or p.requested_date)
        if p_date != planning_date:
            mixed_date_pickups.append(f"{p.pickup_code} ({p_date})")

    if mixed_date_pickups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Selected pickups are not scheduled for planning date ({planning_date}). "
                f"Cannot combine pickups from different dates: {', '.join(mixed_date_pickups[:5])}."
            ),
        )

    # 2. Enforce pickup status: Must be SCHEDULED
    ineligible_pickups = [p for p in pickups if p.status != PickupStatus.SCHEDULED]
    if ineligible_pickups:
        ineligible_details = [f"{p.pickup_code} ({p.status.value})" for p in ineligible_pickups[:5]]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pickups must be in SCHEDULED status before route optimization. Ineligible: {', '.join(ineligible_details)}.",
        )

    # 3. Check for existing allocation to active routes (unless rerun)
    existing_stops = (
        db.query(RouteStop)
        .join(Route, Route.id == RouteStop.route_id)
        .filter(
            RouteStop.pickup_id.in_(target_pickup_ids),
            Route.status != RouteStatus.CANCELLED,
        )
        .all()
    )
    if existing_stops and not rerun:
        conflicting_items = []
        for stop in existing_stops:
            conflicting_items.append(f"Pickup #{stop.pickup_id} is in route {stop.route.route_code} ({stop.route.status.value})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected pickups are already allocated to active routes: {', '.join(conflicting_items)}.",
        )

    if not pickups:
        return {
            "route_date": route_date,
            "planning_date": planning_date.isoformat(),
            "warehouse_id": warehouse_id,
            "warehouse_coordinates": [float(warehouse.latitude), float(warehouse.longitude)] if warehouse.latitude and warehouse.longitude else [],
            "vehicles_available": len(fleet_to_use),
            "routes_created": 0,
            "pickups_assigned": 0,
            "unassigned_pickups": [],
            "total_fleet_distance_km": 0.0,
            "max_route_duration_minutes": 0.0,
            "vehicle_utilization_pct": 0.0,
            "cross_vehicle_overlap_km": 0.0,
            "routes": [],
            "routing_source": "NONE",
            "optimization_run_id": None,
            "optimization_run_code": None,
        }

    try:
        max_route_distance_km = get_configuration_float(
            db,
            "logistics.max_route_distance_km",
        )
    except Exception:
        max_route_distance_km = 100.0

    try:
        max_route_duration_minutes = get_configuration_float(
            db,
            "logistics.max_route_duration_minutes",
        )
    except Exception:
        max_route_duration_minutes = 480.0

    try:
        max_pickup_weight_kg = get_configuration_float(
            db,
            "operations.max_pickup_weight_kg",
        )
    except Exception:
        max_pickup_weight_kg = 70.0
    stores: list[Store] = []
    pickup_by_node_index: list[Pickup] = []
    pickups_without_location = [
        pickup for pickup in pickups if pickup.location is None
    ]
    if pickups_without_location:
        missing_location_ids = {pickup.id for pickup in pickups_without_location}
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Scheduled pickups are missing valid locations",
                "unassigned_pickups": [
                    {
                        "pickup_id": pickup.id,
                        "reason": (
                            "Pickup location is unavailable."
                            if pickup.id in missing_location_ids
                            else (
                                "Optimization was aborted because another "
                                "scheduled pickup has no location."
                            )
                        ),
                    }
                    for pickup in pickups
                ],
            },
        )

    priority_value = {
        "URGENT": 3.0,
        "HIGH": 2.0,
        "NORMAL": 1.0,
    }

    pickup_weights = [
        float(pickup.estimated_weight_kg)
        if pickup.estimated_weight_kg is not None
        else 1.0
        for pickup in pickups
    ]
    if any(weight > max_pickup_weight_kg for weight in pickup_weights):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Pickup exceeds the configured maximum pickup weight",
                "max_pickup_weight_kg": max_pickup_weight_kg,
                "unassigned_pickups": [
                    {
                        "pickup_id": pickup.id,
                        "reason": (
                            f"Estimated weight of {weight} kg exceeds the "
                            f"configured maximum of {max_pickup_weight_kg} kg."
                            if weight > max_pickup_weight_kg
                            else (
                                "Optimization was aborted because another "
                                "scheduled pickup exceeds the configured "
                                "maximum weight."
                            )
                        ),
                    }
                    for pickup, weight in zip(pickups, pickup_weights)
                ],
            },
        )

    service_time_default = (
        float(service_time_minutes * 60)
        if service_time_minutes is not None and service_time_minutes > 0
        else None
    )

    for pickup, weight in zip(pickups, pickup_weights):
        location = pickup.location

        store = Store(
            id=str(pickup.id),
            lat=float(location.latitude),
            lon=float(location.longitude),
            demand=float(weight),
            service_s=float(service_time_default or location.service_time_seconds or 300),
            value=priority_value.get(pickup.priority.value, 1.0),
        )
        pickup_by_node_index.append(pickup)
        stores.append(store)

    if not stores:
        raise HTTPException(
            status_code=400,
            detail="No scheduled pickups have valid locations",
        )

    if fleet_to_use:
        if vehicle_capacity_kg is not None and vehicle_capacity_kg > 0:
            capacities = [float(vehicle_capacity_kg) for _ in fleet_to_use]
        else:
            capacities = [float(a.vehicle.capacity_kg) for a in fleet_to_use]
    elif available_vehicles:
        v_subset = available_vehicles[:num_vehicles] if (num_vehicles and num_vehicles > 0) else available_vehicles
        if vehicle_capacity_kg is not None and vehicle_capacity_kg > 0:
            capacities = [float(vehicle_capacity_kg) for _ in v_subset]
        else:
            capacities = [float(v.capacity_kg) for v in v_subset]
    elif num_vehicles is not None and num_vehicles > 0 and vehicle_capacity_kg is not None and vehicle_capacity_kg > 0:
        capacities = [float(vehicle_capacity_kg) for _ in range(num_vehicles)]
    else:
        capacities = [500.0]

    if max_distance_km is not None and max_distance_km > 0:
        effective_max_dist_m = float(max_distance_km) * 1000.0
    else:
        try:
            max_distance_config = get_active_version(
                db,
                "logistics.max_route_distance_km"
            )
            dist_val = float(max_distance_config.value) if max_distance_config else 100.0
        except Exception:
            dist_val = 100.0
        effective_max_dist_m = dist_val * 1000.0

    if max_duration_minutes is not None and max_duration_minutes > 0:
        effective_max_time_s = float(max_duration_minutes) * 60.0
    else:
        try:
            max_duration_config = get_active_version(
                db,
                "logistics.max_route_duration_minutes"
            )
            dur_val = float(max_duration_config.value) if max_duration_config else 480.0
        except Exception:
            dur_val = 480.0
        effective_max_time_s = dur_val * 60.0

    try:
        optimizer_time_limit_seconds = get_configuration_float(
            db,
            "logistics.optimizer_time_limit_seconds",
        ) or 30.0
    except Exception:
        optimizer_time_limit_seconds = 30.0

    lam_back = 2.0
    if local_backward_allowance_km is not None and local_backward_allowance_km > 0:
        lam_back = max(0.5, min(10.0, 3.0 / float(local_backward_allowance_km)))

    config = Config(
        n_vehicles=len(capacities),
        vehicle_capacities=capacities,
        max_dist_m=effective_max_dist_m,
        max_time_s=effective_max_time_s,
        lam_back=lam_back,
        restarts=25,
        time_limit_s=float(optimizer_time_limit_seconds),
    )

    warehouse_point = (
        float(warehouse.latitude),
        float(warehouse.longitude),
    )

    osrm_url = getattr(settings, "OSRM_BASE_URL", None)
    if osrm_url:
        provider = OSRMProvider(osrm_url)
        routing_source = "OSRM"
    else:
        provider = HaversineProvider()
        routing_source = "HAVERSINE_FALLBACK"

    try:
        problem, optimized_routes, uncovered, unreachable = solve(
            stores=stores,
            warehouse=warehouse_point,
            config=config,
            provider=provider,
        )
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Route optimizer could not process the supplied nodes",
                "reason": str(exc),
                "unassigned_pickups": [
                    {
                        "pickup_id": pickup.id,
                        "reason": "Optimization failed before a route was assigned.",
                    }
                    for pickup in pickups
                ],
            },
        ) from exc

    try:
        validated_routes = _validate_optimizer_output(
            stores=stores,
            problem=problem,
            optimized_routes=optimized_routes,
            uncovered=uncovered,
            unreachable=unreachable,
            vehicle_count=len(capacities),
        )
    except HTTPException as exc:
        detail = (
            dict(exc.detail)
            if isinstance(exc.detail, dict)
            else {"message": "Route optimizer returned invalid output", "reason": exc.detail}
        )
        detail["unassigned_pickups"] = [
            {
                "pickup_id": pickup.id,
                "reason": (
                    "No route was dispatched because optimizer output failed "
                    "validation."
                ),
            }
            for pickup in pickup_by_node_index
        ]
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc

    if unreachable or uncovered:
        unreachable_set = set(unreachable)
        unassigned_by_node = {
            index: (
                "Pickup is unreachable within configured vehicle limits (depot distance: "
                f"{round(problem.D[problem.W][index] / 1000.0, 1)} km, max route distance: {round(config.max_dist_m / 1000.0, 1)} km)."
                if index in unreachable_set
                else "Pickup could not be placed on any feasible vehicle route."
            )
            for index in [*uncovered, *unreachable]
        }
        unassigned = [
            {
                "pickup_id": pickup.id,
                "reason": unassigned_by_node.get(
                    index,
                    (
                        "Optimization was aborted because another scheduled "
                        "pickup could not be assigned."
                    ),
                ),
            }
            for index, pickup in enumerate(pickup_by_node_index)
        ]
        reasons_list = [u["reason"] for u in unassigned if "reason" in u and "aborted because another" not in u["reason"]]
        summary_reason = reasons_list[0] if reasons_list else "Pickups cannot be assigned within constraints"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Infeasible route plan: {summary_reason}",
                "pickup_ids": [pickup_by_node_index[i].id for i in [*uncovered, *unreachable]],
                "unassigned_pickups": unassigned,
                "routing_source": routing_source,
            },
        )

    route_inputs = []
    for vehicle_index, pickup_indices in validated_routes:
        if not pickup_indices:
            continue

        pickup_ids = [
            pickup_by_node_index[index].id
            for index in pickup_indices
        ]
        optimizer_route = [*pickup_indices, problem.W]
        distance_m, duration_s, load_kg = problem.stats(optimizer_route)

        # Build per-stop location data for the frontend map.  These are the
        # real database coordinates — no synthetic values are used.
        stop_locations = []
        for seq, idx in enumerate(pickup_indices, start=1):
            p = pickup_by_node_index[idx]
            loc = p.location
            stop_locations.append(
                {
                    "pickup_id": p.id,
                    "sequence_number": seq,
                    "location_name": loc.name,
                    "lat": float(loc.latitude),
                    "lng": float(loc.longitude),
                    "estimated_weight_kg": (
                        float(p.estimated_weight_kg)
                        if p.estimated_weight_kg is not None
                        else None
                    ),
                }
            )

        route_inputs.append(
            {
                "vehicle_index": vehicle_index,
                "pickup_ids": pickup_ids,
                "distance_km": distance_m / 1000.0,
                "duration_minutes": duration_s / 60.0,
                "load_kg": load_kg,
                "stop_locations": stop_locations,
            }
        )

    if not route_inputs:
        raise HTTPException(
            status_code=409,
            detail="Optimizer produced no non-empty routes",
        )

    eligible_pickup_ids = {pickup.id for pickup in pickup_by_node_index}
    _validate_route_inputs(route_inputs, eligible_pickup_ids)

    try:
        # Keep draft replacement, pickup assignment, and new stops atomic.
        with db.begin_nested():
            if auto_dispatch and fleet_to_use:
                locked_fleet = (
                    db.query(DriverVehicleAssignment)
                    .join(Driver, Driver.id == DriverVehicleAssignment.driver_id)
                    .join(Vehicle, Vehicle.id == DriverVehicleAssignment.vehicle_id)
                    .filter(
                        DriverVehicleAssignment.id.in_([a.id for a in fleet_to_use]),
                    )
                    .with_for_update()
                    .all()
                )

                if len(locked_fleet) != len(fleet_to_use):
                    raise HTTPException(status_code=409, detail="Available fleet changed. Retry optimization.")
            else:
                locked_fleet = []

            locked_pickups = (
                db.query(Pickup)
                .filter(Pickup.id.in_(eligible_pickup_ids))
                .with_for_update()
                .all()
            )

            if len(locked_pickups) != len(eligible_pickup_ids):
                raise HTTPException(status_code=409, detail="Pickup set changed. Retry optimization.")

            locked_pickup_by_id = {pickup.id: pickup for pickup in locked_pickups}
            day_start, day_end = _day_bounds(route_date)
            if any(
                pickup.status != PickupStatus.SCHEDULED
                or pickup.scheduled_date is None
                or not day_start <= pickup.scheduled_date < day_end
                for pickup in locked_pickups
            ):
                raise HTTPException(
                    status_code=409,
                    detail="One or more pickups are no longer eligible. Retry optimization.",
                )

            day_routes = (
                db.query(Route)
                .filter(
                    Route.warehouse_id == warehouse.id,
                    Route.route_date >= day_start,
                    Route.route_date < day_end,
                )
                .with_for_update()
                .all()
            )
            draft_routes = [
                route
                for route in day_routes
                if route.status == RouteStatus.DRAFT
                and route.driver_id is None
                and route.vehicle_id is None
            ]
            draft_route_ids = {route.id for route in draft_routes}
            draft_stops = (
                db.query(RouteStop)
                .filter(RouteStop.route_id.in_(draft_route_ids))
                .with_for_update()
                .all()
                if draft_route_ids
                else []
            )

            stops_by_route: dict[int, list[RouteStop]] = {}
            for stop in draft_stops:
                stops_by_route.setdefault(stop.route_id, []).append(stop)

            replaceable_drafts = []
            for route in draft_routes:
                stops = stops_by_route.get(route.id, [])
                if all(
                    stop.execution_status == RouteStopStatus.PENDING
                    and stop.arrived_at is None
                    and stop.departure_time is None
                    and stop.completed_at is None
                    and stop.proof_storage_path is None
                    and stop.proof_uploaded_at is None
                    and stop.collected_weight_kg is None
                    and stop.failure_reason is None
                    and (
                        stop.stop_type == RouteStopType.WAREHOUSE
                        or stop.pickup_id in eligible_pickup_ids
                    )
                    for stop in stops
                ):
                    replaceable_drafts.append(route)

            existing_pickup_stops = (
                db.query(RouteStop)
                .filter(RouteStop.pickup_id.in_(eligible_pickup_ids))
                .with_for_update()
                .all()
            )
            existing_route_ids = {
                stop.route_id for stop in existing_pickup_stops
            }
            protected_route_ids = existing_route_ids - {
                route.id for route in replaceable_drafts
            }
            if protected_route_ids:
                protected_pickup_ids = {
                    stop.pickup_id
                    for stop in existing_pickup_stops
                    if stop.route_id in protected_route_ids
                }
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": (
                            "One or more eligible pickups already belong to "
                            "a route that cannot be replaced."
                        ),
                        "unassigned_pickups": [
                            {
                                "pickup_id": pickup_id,
                                "reason": (
                                    "Pickup is linked to an assigned, active, "
                                    "completed, or otherwise protected route."
                                    if pickup_id in protected_pickup_ids
                                    else (
                                        "Optimization was aborted because "
                                        "another eligible pickup is linked to "
                                        "a protected route."
                                    )
                                ),
                            }
                            for pickup_id in sorted(eligible_pickup_ids)
                        ],
                    },
                )

            fleet_source = locked_fleet if (auto_dispatch and locked_fleet) else fleet_to_use
            fleet_by_id = {assignment.id: assignment for assignment in fleet_source}
            assignment_for_index = {
                index: fleet_by_id[fleet_to_use[index].id]
                for index in range(len(fleet_to_use))
                if fleet_to_use[index].id in fleet_by_id
            } if fleet_to_use else {}
            replaceable_drafts.sort(key=lambda route: route.id)
            summaries = []

            # If opt_run already exists (e.g. submitted batch), update it rather than creating a duplicate
            if opt_run is not None:
                opt_run.status = "DRAFT"
                opt_run.routes_created = len(route_inputs)
                opt_run.pickups_assigned = sum(len(x["pickup_ids"]) for x in route_inputs)
                opt_run.summary_metrics = {
                    "total_distance_km": round(sum(x["distance_km"] for x in route_inputs), 2),
                    "max_duration_minutes": round(max((x["duration_minutes"] for x in route_inputs), default=0.0), 1),
                }
                params = dict(opt_run.parameters or {})
                params.update({
                    "num_vehicles": num_vehicles,
                    "vehicle_capacity_kg": vehicle_capacity_kg,
                    "max_distance_km": max_distance_km,
                    "max_duration_minutes": max_duration_minutes,
                    "rerun": rerun,
                })
                opt_run.parameters = params
                db.flush()

                # Ensure OptimizationRunPickup rows exist
                existing_pids = {sp.pickup_id for sp in opt_run.submitted_pickups}
                for pid in eligible_pickup_ids:
                    if pid not in existing_pids:
                        db.add(OptimizationRunPickup(optimization_run_id=opt_run.id, pickup_id=pid))
                db.flush()
            else:
                # Supersede any previous draft optimization runs for this warehouse and planning date
                p_start, p_end = get_planning_date_bounds(planning_date)
                db.query(OptimizationRun).filter(
                    OptimizationRun.warehouse_id == warehouse.id,
                    OptimizationRun.planning_date >= p_start,
                    OptimizationRun.planning_date < p_end,
                    OptimizationRun.status == "DRAFT",
                ).update({"status": "SUPERSEDED"}, synchronize_session=False)

                opt_run_code = f"OPT-{planning_date.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
                opt_run = OptimizationRun(
                    run_code=opt_run_code,
                    planning_date=datetime.combine(planning_date, dt_time.min, tzinfo=BUSINESS_TIMEZONE),
                    warehouse_id=warehouse.id,
                    status="DRAFT",
                    routes_created=len(route_inputs),
                    pickups_assigned=sum(len(x["pickup_ids"]) for x in route_inputs),
                    summary_metrics={
                        "total_distance_km": round(sum(x["distance_km"] for x in route_inputs), 2),
                        "max_duration_minutes": round(max((x["duration_minutes"] for x in route_inputs), default=0.0), 1),
                    },
                    parameters={
                        "num_vehicles": num_vehicles,
                        "vehicle_capacity_kg": vehicle_capacity_kg,
                        "max_distance_km": max_distance_km,
                        "max_duration_minutes": max_duration_minutes,
                        "rerun": rerun,
                        "pickup_ids": list(eligible_pickup_ids),
                    },
                    created_by_id=actor.id if actor else None,
                )
                db.add(opt_run)
                db.flush()

                for pid in eligible_pickup_ids:
                    db.add(OptimizationRunPickup(optimization_run_id=opt_run.id, pickup_id=pid))
                db.flush()

            db.query(RouteStop).filter(
                RouteStop.route_id.in_(
                    [route.id for route in replaceable_drafts]
                )
            ).delete(synchronize_session=False)
            db.flush()

            if rerun:
                for draft_route in replaceable_drafts:
                    draft_route.status = RouteStatus.CANCELLED
                replaceable_drafts = []
            else:
                for draft_route in replaceable_drafts[len(route_inputs):]:
                    draft_route.status = RouteStatus.CANCELLED

            for index, item in enumerate(route_inputs):
                assignment = assignment_for_index.get(item["vehicle_index"])
                driver = assignment.driver if assignment else None
                vehicle = assignment.vehicle if assignment else (available_vehicles[index] if index < len(available_vehicles) else None)

                if auto_dispatch:
                    if not driver or driver.status != DriverStatus.ACTIVE or not driver.is_available:
                        raise HTTPException(status_code=409, detail="A driver is no longer available. Retry optimization.")
                    if not vehicle or vehicle.status in {
                        VehicleStatus.MAINTENANCE,
                        VehicleStatus.INACTIVE,
                    }:
                        raise HTTPException(status_code=409, detail="A vehicle is no longer available. Retry optimization.")

                target_status = RouteStatus.ASSIGNED if auto_dispatch else RouteStatus.DRAFT
                target_driver_id = driver.id if (auto_dispatch and driver) else None
                target_vehicle_id = vehicle.id if (auto_dispatch and vehicle) else None

                if index < len(replaceable_drafts):
                    route = replaceable_drafts[index]
                    route.driver_id = target_driver_id
                    route.vehicle_id = target_vehicle_id
                    route.status = target_status
                    route.planned_distance_km = round(item["distance_km"], 2)
                    route.planned_duration_seconds = round(item["duration_minutes"] * 60)
                    route.optimized_at = datetime.now(timezone.utc)
                    route.approved_at = None
                    route.approved_by_id = None
                    route.optimization_run_id = opt_run.id
                else:
                    route = Route(
                        route_code=_route_code(route_date),
                        route_date=route_date,
                        warehouse_id=warehouse.id,
                        driver_id=target_driver_id,
                        vehicle_id=target_vehicle_id,
                        status=target_status,
                        planned_distance_km=round(item["distance_km"], 2),
                        planned_duration_seconds=round(item["duration_minutes"] * 60),
                        optimized_at=datetime.now(timezone.utc),
                        optimization_run_id=opt_run.id,
                    )
                    db.add(route)
                    db.flush()

                if auto_dispatch and driver:
                    notify_driver_assigned(
                        db,
                        driver_user_id=driver.user_id,
                        route_id=route.id,
                        route_code=route.route_code,
                    )

                sequence = 1
                for pickup_id in item["pickup_ids"]:
                    pickup = locked_pickup_by_id[pickup_id]
                    if auto_dispatch:
                        pickup.status = PickupStatus.ASSIGNED
                    db.add(
                        RouteStop(
                            route_id=route.id,
                            sequence_number=sequence,
                            stop_type=RouteStopType.PICKUP,
                            pickup_id=pickup.id,
                        )
                    )
                    sequence += 1

                db.add(
                    RouteStop(
                        route_id=route.id,
                        sequence_number=sequence,
                        stop_type=RouteStopType.WAREHOUSE,
                        warehouse_id=warehouse.id,
                    )
                )

                if auto_dispatch:
                    if driver:
                        driver.is_available = False
                    if vehicle:
                        vehicle.status = VehicleStatus.ASSIGNED

                polyline = [
                    [float(warehouse.latitude), float(warehouse.longitude)]
                ]
                for loc in item.get("stop_locations", []):
                    polyline.append([loc["lat"], loc["lng"]])
                polyline.append([float(warehouse.latitude), float(warehouse.longitude)])

                summaries.append(
                    {
                        "route_id": route.id,
                        "route_code": route.route_code,
                        "driver_id": target_driver_id,
                        "vehicle_id": target_vehicle_id,
                        "pickup_ids": item["pickup_ids"],
                        "distance_km": round(item["distance_km"], 2),
                        "duration_minutes": round(item["duration_minutes"], 1),
                        "load_kg": round(item["load_kg"], 2),
                        "stop_locations": item.get("stop_locations", []),
                        "polyline": polyline,
                        "backtrack_km": 0.0,
                        "status": route.status.value,
                        "is_approved": route.approved_at is not None,
                    }
                )

            db.flush()

        db.commit()
    except Exception:
        db.rollback()
        raise

    log_operational_audit(
        db=db,
        action="OPTIMIZATION_RERUN" if rerun else "OPTIMIZATION_CREATE",
        entity_type="OPTIMIZATION_RUN",
        entity_id=opt_run.id,
        entity_code=opt_run.run_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "planning_date": planning_date.isoformat(),
            "warehouse_id": warehouse.id,
            "routes_created": len(summaries),
            "pickups_assigned": sum(len(x["pickup_ids"]) for x in summaries),
            "rerun": rerun,
        },
    )

    total_fleet_dist = sum(x["distance_km"] for x in summaries)
    max_dur = max((x["duration_minutes"] for x in summaries), default=0.0)
    total_load = sum(x["load_kg"] for x in summaries)
    total_capacity = sum(capacities[:len(summaries)]) or 1.0
    utilization_pct = min(100.0, round((total_load / total_capacity) * 100, 1))

    total_overlap_km = 0.0
    if routing_source == "OSRM" and hasattr(provider, "route"):
        try:
            from app.optimizer.overlap import segments, backtrack_m, fleet_overlap
            seg_lists = []
            for r_summary in summaries:
                points = [(float(warehouse.latitude), float(warehouse.longitude))]
                for stop in r_summary.get("stop_locations", []):
                    points.append((stop["lat"], stop["lng"]))
                points.append((float(warehouse.latitude), float(warehouse.longitude)))
                r_road = provider.route(points)
                r_segs = segments(r_road)
                seg_lists.append(r_segs)
                r_summary["backtrack_km"] = round(backtrack_m(r_segs) / 1000.0, 2)
            pairs = fleet_overlap(seg_lists, 1500.0)
            total_overlap_km = round(sum(pairs.values()) / 1000.0, 2)
        except Exception:
            pass

    return {
        "route_date": route_date,
        "planning_date": planning_date.isoformat(),
        "warehouse_id": warehouse.id,
        "warehouse_coordinates": [float(warehouse.latitude), float(warehouse.longitude)],
        "vehicles_available": len(fleet_to_use),
        "routes_created": len(summaries),
        "pickups_assigned": sum(len(x["pickup_ids"]) for x in summaries),
        "unassigned_pickups": [],
        "total_fleet_distance_km": round(total_fleet_dist, 2),
        "max_route_duration_minutes": round(max_dur, 1),
        "vehicle_utilization_pct": utilization_pct,
        "cross_vehicle_overlap_km": total_overlap_km,
        "routes": summaries,
        "routing_source": routing_source,
        "optimization_run_id": opt_run.id,
        "optimization_run_code": opt_run.run_code,
    }

def get_available_fleet(db: Session):
    assignments = (
        db.query(DriverVehicleAssignment)
        .join(
            Driver,
            Driver.id == DriverVehicleAssignment.driver_id,
        )
        .join(
            Vehicle,
            Vehicle.id == DriverVehicleAssignment.vehicle_id,
        )
        .filter(
            DriverVehicleAssignment.unassigned_at.is_(None),

            Driver.status == DriverStatus.ACTIVE,
            Driver.is_available.is_(True),

            Vehicle.status.notin_(
                [
                    VehicleStatus.MAINTENANCE,
                    VehicleStatus.INACTIVE,
                ]
            ),
        )
        .options(
            joinedload(DriverVehicleAssignment.driver),
            joinedload(DriverVehicleAssignment.vehicle),
        )
        .all()
    )

    return assignments


def get_latest_optimization_run(
    db: Session,
    warehouse_id: int | None = None,
    planning_date: datetime | None = None,
) -> OptimizationRun | None:
    query = db.query(OptimizationRun)
    if warehouse_id:
        query = query.filter(OptimizationRun.warehouse_id == warehouse_id)
    if planning_date:
        p_date = normalize_to_business_date(planning_date) or planning_date.date()
        start, end = get_planning_date_bounds(p_date)
        query = query.filter(OptimizationRun.planning_date >= start, OptimizationRun.planning_date < end)
    return query.order_by(OptimizationRun.id.desc()).first()


def list_optimization_runs(
    db: Session,
    warehouse_id: int | None = None,
    limit: int = 20,
) -> list[OptimizationRun]:
    query = db.query(OptimizationRun)
    if warehouse_id:
        query = query.filter(OptimizationRun.warehouse_id == warehouse_id)
    return query.order_by(OptimizationRun.id.desc()).limit(limit).all()


def submit_optimization_batch(
    db: Session,
    warehouse_id: int,
    pickup_ids: list[int],
    planning_date: date | datetime | str | None = None,
    actor: User | None = None,
    current_user: User | None = None,
) -> dict:
    actor = actor or current_user
    if not pickup_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one pickup must be selected.",
        )
    if len(pickup_ids) != len(set(pickup_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate pickup IDs in submission.",
        )

    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    if not warehouse.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse is inactive")

    # Planning date normalization
    if planning_date is None:
        op_date = get_operational_planning_date()
    elif isinstance(planning_date, datetime):
        op_date = normalize_to_business_date(planning_date) or planning_date.date()
    elif isinstance(planning_date, date):
        op_date = planning_date
    else:
        try:
            op_date = datetime.strptime(str(planning_date)[:10], "%Y-%m-%d").date()
        except Exception:
            op_date = get_operational_planning_date()

    # Lock and revalidate pickups atomically
    pickups = (
        db.query(Pickup)
        .filter(Pickup.id.in_(pickup_ids))
        .with_for_update()
        .all()
    )
    if len(pickups) != len(pickup_ids):
        found_ids = {p.id for p in pickups}
        missing = sorted(set(pickup_ids) - found_ids)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pickup(s) not found: {missing}")

    # Validate eligibility
    for p in pickups:
        if p.status != PickupStatus.SCHEDULED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pickup {p.pickup_code} must be in SCHEDULED status (currently {p.status.value}).",
            )
        p_date = normalize_to_business_date(p.scheduled_date or p.requested_date)
        if p_date != op_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pickup {p.pickup_code} is scheduled for {p_date}, but batch is for operating date {op_date}.",
            )
        if not p.location or p.location.latitude is None or p.location.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pickup {p.pickup_code} is missing valid geographic coordinates.",
            )

    # Check not in active route
    active_stops = (
        db.query(RouteStop)
        .join(Route, Route.id == RouteStop.route_id)
        .filter(
            RouteStop.pickup_id.in_(pickup_ids),
            Route.status != RouteStatus.CANCELLED,
        )
        .all()
    )
    if active_stops:
        conflicts = [f"Pickup #{s.pickup_id} is in active route {s.route.route_code} ({s.route.status.value})" for s in active_stops]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pickups are already assigned to active routes: {', '.join(conflicts)}",
        )

    # Check not in another active optimization batch
    active_batch_pickups = (
        db.query(OptimizationRunPickup)
        .join(OptimizationRun, OptimizationRun.id == OptimizationRunPickup.optimization_run_id)
        .filter(
            OptimizationRunPickup.pickup_id.in_(pickup_ids),
            OptimizationRun.status.in_(["SUBMITTED", "DRAFT", "OPTIMIZED"]),
        )
        .all()
    )
    if active_batch_pickups:
        conflicts = [
            f"Pickup #{bp.pickup_id} in active batch #{bp.optimization_run_id} ({bp.optimization_run.run_code})"
            for bp in active_batch_pickups
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pickups are already in an active optimization batch: {', '.join(conflicts)}",
        )

    run_code = f"BATCH-{op_date.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    run = OptimizationRun(
        run_code=run_code,
        planning_date=datetime.combine(op_date, dt_time.min, tzinfo=BUSINESS_TIMEZONE),
        warehouse_id=warehouse.id,
        status="SUBMITTED",
        routes_created=0,
        pickups_assigned=0,
        parameters={
            "pickup_ids": pickup_ids,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        },
        created_by_id=actor.id if actor else None,
    )
    db.add(run)
    db.flush()

    for pid in pickup_ids:
        db.add(OptimizationRunPickup(optimization_run_id=run.id, pickup_id=pid))
    db.flush()
    db.commit()

    log_operational_audit(
        db=db,
        action="OPTIMIZATION_BATCH_SUBMITTED",
        entity_type="OPTIMIZATION_BATCH",
        entity_id=run.id,
        entity_code=run.run_code,
        actor_id=actor.id if actor else None,
        actor_name=getattr(actor, "name", None) or getattr(actor, "full_name", None) or "Admin",
        details={
            "planning_date": op_date.isoformat(),
            "warehouse_id": warehouse.id,
            "pickup_count": len(pickup_ids),
            "pickup_ids": pickup_ids,
        },
    )

    return {
        "batch_id": run.id,
        "batch_code": run.run_code,
        "planning_date": op_date.isoformat(),
        "warehouse_id": warehouse.id,
        "status": run.status,
        "pickup_count": len(pickup_ids),
        "pickup_ids": pickup_ids,
        "created_at": run.created_at.isoformat(),
        "created_by_id": run.created_by_id,
        "routes_created": 0,
    }


def get_optimization_batch(db: Session, batch_id: int) -> dict:
    run = (
        db.query(OptimizationRun)
        .options(
            joinedload(OptimizationRun.submitted_pickups).joinedload(OptimizationRunPickup.pickup).joinedload(Pickup.location),
            joinedload(OptimizationRun.routes).joinedload(Route.stops).joinedload(RouteStop.pickup).joinedload(Pickup.location),
        )
        .filter(OptimizationRun.id == batch_id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail=f"Optimization batch #{batch_id} not found.")

    p_date = normalize_to_business_date(run.planning_date) or run.planning_date.date()
    p_ids = [sp.pickup_id for sp in run.submitted_pickups]
    if not p_ids and run.parameters and "pickup_ids" in run.parameters:
        p_ids = run.parameters["pickup_ids"]

    # Gather pickup details
    pickups_data = []
    for sp in run.submitted_pickups:
        p = sp.pickup
        if p:
            loc = p.location
            pickups_data.append({
                "id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "location_name": loc.name if loc else "",
                "latitude": float(loc.latitude) if loc and loc.latitude else None,
                "longitude": float(loc.longitude) if loc and loc.longitude else None,
                "address_line1": loc.address_line_1 if loc else "",
                "city": loc.city if loc else "",
                "estimated_weight_kg": float(p.estimated_weight_kg) if p.estimated_weight_kg is not None else 1.0,
                "priority": p.priority.value if p.priority else "NORMAL",
                "status": p.status.value if p.status else "SCHEDULED",
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
            })

    # If submitted_pickups relationship was empty but p_ids has IDs, load them
    if not pickups_data and p_ids:
        raw_pickups = (
            db.query(Pickup)
            .options(joinedload(Pickup.location))
            .filter(Pickup.id.in_(p_ids))
            .order_by(Pickup.created_at.asc())
            .all()
        )
        for p in raw_pickups:
            loc = p.location
            pickups_data.append({
                "id": p.id,
                "pickup_code": p.pickup_code,
                "customer_id": p.customer_id,
                "location_name": loc.name if loc else "",
                "latitude": float(loc.latitude) if loc and loc.latitude else None,
                "longitude": float(loc.longitude) if loc and loc.longitude else None,
                "address_line1": loc.address_line_1 if loc else "",
                "city": loc.city if loc else "",
                "estimated_weight_kg": float(p.estimated_weight_kg) if p.estimated_weight_kg is not None else 1.0,
                "priority": p.priority.value if p.priority else "NORMAL",
                "status": p.status.value if p.status else "SCHEDULED",
                "scheduled_date": p.scheduled_date.isoformat() if p.scheduled_date else None,
            })

    # Format routes
    routes_data = []
    warehouse = db.query(Warehouse).filter(Warehouse.id == run.warehouse_id).first()
    wh_lat = float(warehouse.latitude) if warehouse and warehouse.latitude else 0.0
    wh_lng = float(warehouse.longitude) if warehouse and warehouse.longitude else 0.0

    for r in run.routes:
        if r.status == RouteStatus.CANCELLED:
            continue
        stops_locs = []
        r_pickup_ids = []
        for s in sorted(r.stops, key=lambda x: x.sequence_number):
            if s.stop_type == RouteStopType.PICKUP and s.pickup:
                loc = s.pickup.location
                r_pickup_ids.append(s.pickup_id)
                stops_locs.append({
                    "pickup_id": s.pickup.id,
                    "sequence_number": s.sequence_number,
                    "location_name": loc.name if loc else "",
                    "lat": float(loc.latitude) if loc and loc.latitude else 0.0,
                    "lng": float(loc.longitude) if loc and loc.longitude else 0.0,
                    "estimated_weight_kg": float(s.pickup.estimated_weight_kg) if s.pickup.estimated_weight_kg is not None else 1.0,
                })
        polyline = [[wh_lat, wh_lng]]
        for sl in stops_locs:
            polyline.append([sl["lat"], sl["lng"]])
        polyline.append([wh_lat, wh_lng])

        routes_data.append({
            "route_id": r.id,
            "route_code": r.route_code,
            "driver_id": r.driver_id,
            "vehicle_id": r.vehicle_id,
            "pickup_ids": r_pickup_ids,
            "distance_km": float(r.planned_distance_km or 0.0),
            "duration_minutes": round((r.planned_duration_seconds or 0) / 60.0, 1),
            "load_kg": round(sum(sl["estimated_weight_kg"] for sl in stops_locs), 2),
            "stop_locations": stops_locs,
            "polyline": polyline,
            "backtrack_km": 0.0,
            "status": r.status.value,
            "is_approved": r.approved_at is not None,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
        })

    return {
        "batch_id": run.id,
        "batch_code": run.run_code,
        "planning_date": p_date.isoformat(),
        "warehouse_id": run.warehouse_id,
        "status": run.status,
        "pickup_count": len(p_ids),
        "pickup_ids": p_ids,
        "created_at": run.created_at.isoformat(),
        "created_by_id": run.created_by_id,
        "routes_created": len(routes_data),
        "pickups": pickups_data,
        "routes": routes_data,
        "summary_metrics": run.summary_metrics,
    }


def get_active_optimization_batch(
    db: Session,
    warehouse_id: int | None = None,
    planning_date: date | datetime | str | None = None,
) -> dict | None:
    query = db.query(OptimizationRun)
    if warehouse_id:
        query = query.filter(OptimizationRun.warehouse_id == warehouse_id)
    if planning_date:
        if isinstance(planning_date, str):
            try:
                op_date = datetime.strptime(planning_date[:10], "%Y-%m-%d").date()
            except Exception:
                op_date = get_operational_planning_date()
        elif isinstance(planning_date, datetime):
            op_date = normalize_to_business_date(planning_date) or planning_date.date()
        else:
            op_date = planning_date
        start, end = get_planning_date_bounds(op_date)
        query = query.filter(OptimizationRun.planning_date >= start, OptimizationRun.planning_date < end)

    run = (
        query.filter(OptimizationRun.status.in_(["SUBMITTED", "DRAFT", "OPTIMIZED"]))
        .order_by(OptimizationRun.id.desc())
        .first()
    )
    if not run:
        return None
    return get_optimization_batch(db, run.id)

