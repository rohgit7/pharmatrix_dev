from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.pickup import PickupCreate, PickupResponse
from app.services.pickup_service import (
    create_pickup,
    get_customer_pickup,
    list_customer_pickups,
)


router = APIRouter(
    prefix="/api/pickups",
    tags=["Pickups"],
)


@router.post(
    "/",
    response_model=PickupResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def create_pickup_endpoint(
    data: PickupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_pickup(
        db=db,
        current_user=current_user,
        location_id=data.location_id,
        requested_date=data.requested_date,
        priority=data.priority,
        estimated_weight_kg=data.estimated_weight_kg,
        notes=data.notes,
    )


@router.get(
    "/",
    response_model=list[PickupResponse],
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def list_my_pickups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_customer_pickups(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/{pickup_id}",
    response_model=PickupResponse,
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_my_pickup(
    pickup_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )