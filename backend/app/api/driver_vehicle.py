from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.enums import UserRole
from app.schemas.driver_vehicle import (
    DriverVehicleAssignRequest,
    DriverVehicleAssignmentResponse,
)
from app.services.driver_vehicle_service import (
    assign_vehicle_to_driver,
    get_driver_active_vehicle,
    get_driver_assignment_history,
    get_vehicle_active_driver,
    unassign_vehicle_from_driver,
)

router = APIRouter(
    prefix="/api/admin/driver-vehicle",
    tags=["Driver Vehicle Assignment"],
)


@router.post(
    "/assign",
    response_model=DriverVehicleAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_vehicle(
    data: DriverVehicleAssignRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return assign_vehicle_to_driver(
        db=db,
        driver_id=data.driver_id,
        vehicle_id=data.vehicle_id,
        notes=data.notes,
    )


@router.post(
    "/drivers/{driver_id}/unassign",
    response_model=DriverVehicleAssignmentResponse,
)
def unassign_vehicle(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return unassign_vehicle_from_driver(
        db=db,
        driver_id=driver_id,
    )


@router.get(
    "/drivers/{driver_id}/active",
    response_model=DriverVehicleAssignmentResponse | None,
)
def get_driver_vehicle(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return get_driver_active_vehicle(
        db=db,
        driver_id=driver_id,
    )


@router.get(
    "/vehicles/{vehicle_id}/active",
    response_model=DriverVehicleAssignmentResponse | None,
)
def get_vehicle_driver(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return get_vehicle_active_driver(
        db=db,
        vehicle_id=vehicle_id,
    )


@router.get(
    "/drivers/{driver_id}/history",
    response_model=list[DriverVehicleAssignmentResponse],
)
def get_driver_history(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return get_driver_assignment_history(
        db=db,
        driver_id=driver_id,
    )