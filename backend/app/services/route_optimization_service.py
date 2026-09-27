from __future__ import annotations

from datetime import datetime, time as dt_time, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.core.config import settings
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import DriverStatus, PickupStatus, RouteStatus, RouteStopType, VehicleStatus
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.optimizer import Config, HaversineProvider, OSRMProvider, Store, solve


def _route_code(route_date: datetime) -> str:
    return f"RT-{route_date:%Y%m%d}-{uuid4().hex[:6].upper()}"


def _day_bounds(route_date: datetime):
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
            Vehicle.status == VehicleStatus.AVAILABLE,
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


def optimize_and_dispatch(
    db: Session,
    warehouse_id: int,
    route_date: datetime,
):
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
    if not fleet:
        raise HTTPException(
            status_code=409,
            detail="No available driver-vehicle assignments",
        )

    pickups = _scheduled_pickups(db, route_date)
    if not pickups:
        raise HTTPException(
            status_code=400,
            detail="No scheduled pickups for this date",
        )

    stores: list[Store] = []
    pickup_by_optimizer_id: dict[int, Pickup] = {}

    priority_value = {
        "URGENT": 3.0,
        "HIGH": 2.0,
        "NORMAL": 1.0,
    }

    for pickup in pickups:
        location = pickup.location
        if location is None:
            continue

        weight = getattr(pickup, "estimated_weight_kg", None)
        if weight is None:
            weight = 1.0

        store = Store(
            id=str(pickup.id),
            lat=float(location.latitude),
            lon=float(location.longitude),
            demand=float(weight),
            service_s=float(location.service_time_seconds or 300),
            value=priority_value.get(pickup.priority.value, 1.0),
        )
        stores.append(store)
        pickup_by_optimizer_id[pickup.id] = pickup

    if not stores:
        raise HTTPException(
            status_code=400,
            detail="No scheduled pickups have valid locations",
        )

    capacities = [float(a.vehicle.capacity_kg) for a in fleet]
    config = Config(
        n_vehicles=len(fleet),
        vehicle_capacities=capacities,
        max_dist_m=80_000.0,
        max_time_s=5 * 3600.0,
        restarts=25,
        time_limit_s=30.0,
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

    problem, optimized_routes, uncovered, unreachable = solve(
        stores=stores,
        warehouse=warehouse_point,
        config=config,
        provider=provider,
    )

    if unreachable or uncovered:
        unresolved = [
            int(stores[i].id)
            for i in (uncovered + unreachable)
            if i < len(stores)
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Not all scheduled pickups can be assigned with the available fleet",
                "pickup_ids": unresolved,
                "routing_source": routing_source,
            },
        )

    route_inputs = []
    for vehicle_index, route in enumerate(optimized_routes):
        pickup_indices = route[:-1]
        if not pickup_indices:
            continue

        pickup_ids = [int(stores[index].id) for index in pickup_indices]
        distance_m, duration_s, load_kg = problem.stats(route)
        route_inputs.append(
            {
                "vehicle_index": vehicle_index,
                "pickup_ids": pickup_ids,
                "distance_km": distance_m / 1000.0,
                "duration_minutes": duration_s / 60.0,
                "load_kg": load_kg,
            }
        )

    if not route_inputs:
        raise HTTPException(
            status_code=409,
            detail="Optimizer produced no non-empty routes",
        )

    # Revalidate under row locks before writing anything. This protects against
    # another admin dispatching the same pickups or taking a vehicle meanwhile.
    with db.begin_nested():
        locked_fleet = (
            db.query(DriverVehicleAssignment)
            .join(Driver, Driver.id == DriverVehicleAssignment.driver_id)
            .join(Vehicle, Vehicle.id == DriverVehicleAssignment.vehicle_id)
            .filter(
                DriverVehicleAssignment.id.in_([a.id for a in fleet]),
            )
            .with_for_update()
            .all()
        )

        if len(locked_fleet) != len(fleet):
            raise HTTPException(status_code=409, detail="Available fleet changed. Retry optimization.")

        locked_pickups = (
            db.query(Pickup)
            .filter(Pickup.id.in_(pickup_by_optimizer_id.keys()))
            .with_for_update()
            .all()
        )

        if len(locked_pickups) != len(pickup_by_optimizer_id):
            raise HTTPException(status_code=409, detail="Pickup set changed. Retry optimization.")

        if any(p.status != PickupStatus.SCHEDULED for p in locked_pickups):
            raise HTTPException(status_code=409, detail="One or more pickups are no longer scheduled. Retry optimization.")

        fleet_by_id = {assignment.id: assignment for assignment in locked_fleet}
        assignment_for_index = {
            index: fleet_by_id[fleet[index].id]
            for index in range(len(fleet))
        }

        summaries = []

        for item in route_inputs:
            assignment = assignment_for_index[item["vehicle_index"]]
            driver = assignment.driver
            vehicle = assignment.vehicle

            if driver.status != DriverStatus.ACTIVE or not driver.is_available:
                raise HTTPException(status_code=409, detail="A driver is no longer available. Retry optimization.")
            if vehicle.status != VehicleStatus.AVAILABLE:
                raise HTTPException(status_code=409, detail="A vehicle is no longer available. Retry optimization.")

            route = Route(
                route_code=_route_code(route_date),
                route_date=route_date,
                warehouse_id=warehouse.id,
                driver_id=driver.id,
                vehicle_id=vehicle.id,
                status=RouteStatus.ASSIGNED,
                planned_distance_km=round(item["distance_km"], 2),
                planned_duration_seconds=round(item["duration_minutes"] * 60),
                optimized_at=datetime.now(timezone.utc),
            )
            db.add(route)
            db.flush()

            sequence = 1
            for pickup_id in item["pickup_ids"]:
                pickup = pickup_by_optimizer_id[pickup_id]
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

            driver.is_available = False
            vehicle.status = VehicleStatus.ASSIGNED

            summaries.append(
                {
                    "route_id": route.id,
                    "route_code": route.route_code,
                    "driver_id": driver.id,
                    "vehicle_id": vehicle.id,
                    "pickup_ids": item["pickup_ids"],
                    "distance_km": round(item["distance_km"], 2),
                    "duration_minutes": round(item["duration_minutes"], 1),
                    "load_kg": round(item["load_kg"], 2),
                }
            )

        db.commit()

    return {
        "route_date": route_date,
        "warehouse_id": warehouse.id,
        "vehicles_available": len(fleet),
        "routes_created": len(summaries),
        "pickups_assigned": sum(len(x["pickup_ids"]) for x in summaries),
        "routes": summaries,
        "routing_source": routing_source,
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
