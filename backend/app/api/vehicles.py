from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
)
from app.services.vehicle_service import (
    create_vehicle,
    get_vehicle,
    list_vehicles,
    update_vehicle,
)


router = APIRouter(
    prefix="/api/admin/vehicles",
    tags=["Admin - Vehicles"],
)


@router.post(
    "/",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vehicle_endpoint(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return create_vehicle(db, data)


@router.get(
    "/",
    response_model=list[VehicleResponse],
)
def list_vehicle_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return list_vehicles(db, skip, limit)


@router.get(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
def get_vehicle_endpoint(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return get_vehicle(db, vehicle_id)


@router.patch(
    "/{vehicle_id}",
    response_model=VehicleResponse,
)
def update_vehicle_endpoint(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return update_vehicle(db, vehicle_id, data)


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_200_OK,
)
def delete_vehicle_endpoint(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    from datetime import datetime, timezone
    from app.models.vehicle import Vehicle
    from app.models.enums import VehicleStatus, RouteStatus
    from app.models.route import Route
    from app.models.driver_vehicle_assignment import DriverVehicleAssignment
    from fastapi import HTTPException

    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    # 1. Protect active routes
    active_routes = (
        db.query(Route)
        .filter(
            Route.vehicle_id == vehicle.id,
            Route.status.in_([RouteStatus.READY, RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS]),
        )
        .all()
    )
    if active_routes:
        codes = ", ".join(r.route_code for r in active_routes[:3])
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vehicle cannot be removed while assigned to active routes ({codes}). Reassign or cancel active routes first.",
        )

    # 2. Detach from draft routes safely
    draft_routes = (
        db.query(Route)
        .filter(
            Route.vehicle_id == vehicle.id,
            Route.status == RouteStatus.DRAFT,
        )
        .all()
    )
    for r in draft_routes:
        r.vehicle_id = None

    # 3. Check for completed routes or vehicle assignments
    has_routes = db.query(Route).filter(Route.vehicle_id == vehicle.id).first() is not None
    assignments = (
        db.query(DriverVehicleAssignment)
        .filter(DriverVehicleAssignment.vehicle_id == vehicle.id)
        .all()
    )

    now = datetime.now(timezone.utc)
    for a in assignments:
        if a.unassigned_at is None:
            a.unassigned_at = now

    if has_routes or assignments:
        vehicle.status = VehicleStatus.INACTIVE
        db.commit()
        return {"message": "Vehicle deactivated safely to preserve historical audit records"}

    try:
        db.delete(vehicle)
        db.commit()
        return {"message": "Vehicle removed successfully"}
    except Exception:
        db.rollback()
        vehicle.status = VehicleStatus.INACTIVE
        db.commit()
        return {"message": "Vehicle deactivated safely"}
