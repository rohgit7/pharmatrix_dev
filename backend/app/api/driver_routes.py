from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.enums import RouteStopType
from app.models.user import User, UserRole
from app.schemas.driver_route import (
    DriverRouteResponse,
    DriverRouteStopResponse,
)
from app.services.driver_route_service import (
    get_driver_route_for_date,
)


router = APIRouter(
    prefix="/api/driver/routes",
    tags=["Driver - Routes"],
    dependencies=[
        Depends(require_role(UserRole.DRIVER))
    ],
)


@router.get(
    "/today",
    response_model=DriverRouteResponse,
)
def get_today_route(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = datetime.now(
        timezone.utc
    ).date()

    route = get_driver_route_for_date(
        db=db,
        user=current_user,
        route_date=today,
    )

    if not route:
        raise HTTPException(
            status_code=404,
            detail="No route assigned for today",
        )

    stops = []

    for stop in route.stops:

        if stop.stop_type == RouteStopType.PICKUP:

            pickup = stop.pickup
            location = pickup.location

            stops.append(
                DriverRouteStopResponse(
                    sequence_number=stop.sequence_number,
                    stop_type=stop.stop_type,

                    pickup_id=pickup.id,
                    pickup_code=pickup.pickup_code,

                    location_id=location.id,
                    location_name=location.name,
                    address=location.address,
                    city=location.city,
                    state=location.state,
                    postal_code=location.postal_code,

                    latitude=float(
                        location.latitude
                    ),
                    longitude=float(
                        location.longitude
                    ),

                    arrival_time=stop.arrival_time,
                    departure_time=stop.departure_time,
                    proof_uploaded=(
                        stop.proof_storage_path is not None
                    ),
                )
            )

        else:
            warehouse = stop.warehouse

            stops.append(
            DriverRouteStopResponse(
                sequence_number=stop.sequence_number,
                stop_type=stop.stop_type,

                warehouse_id=warehouse.id,
                warehouse_name=warehouse.name,

                latitude=float(
                    warehouse.latitude
                ),
                longitude=float(
                    warehouse.longitude
                ),
        

                address=warehouse.address,
                city=warehouse.city,
                state=warehouse.state,
                postal_code=warehouse.postal_code,

                arrival_time=stop.arrival_time,
                departure_time=stop.departure_time,
            )
        )

    return DriverRouteResponse(
        id=route.id,
        route_code=route.route_code,
        route_date=route.route_date,
        status=route.status,

        vehicle_id=route.vehicle_id,
        vehicle_registration_number=(
            route.vehicle.registration_number
            if route.vehicle
            else None
        ),

        warehouse_id=route.warehouse.id,
        warehouse_name=route.warehouse.name,
        warehouse_address=route.warehouse.address,
        warehouse_city=route.warehouse.city,
        warehouse_state=route.warehouse.state,
        warehouse_latitude=float(
            route.warehouse.latitude
        ),
        warehouse_longitude=float(
            route.warehouse.longitude
        ),

        planned_distance_km=(
            float(route.planned_distance_km)
            if route.planned_distance_km is not None
            else None
        ),

        planned_duration_seconds=(
            route.planned_duration_seconds
        ),

        stops=stops,
    )