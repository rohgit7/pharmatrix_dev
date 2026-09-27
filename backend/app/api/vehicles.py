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