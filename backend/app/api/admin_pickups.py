from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.enums import PickupStatus
from app.models.user import UserRole
from app.schemas.pickup import (
    PickupAdminResponse,
    PickupCancelRequest,
    PickupScheduleRequest,
)
from app.services.pickup_service import (
    cancel_pickup,
    get_pickup_by_id,
    list_all_pickups,
    schedule_pickup,
)


router = APIRouter(
    prefix="/api/admin/pickups",
    tags=["Admin - Pickups"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=list[PickupAdminResponse],
)
def admin_list_pickups(
    status: PickupStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_all_pickups(
        db=db,
        status_filter=status,
    )


@router.get(
    "/{pickup_id}",
    response_model=PickupAdminResponse,
)
def admin_get_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
):
    return get_pickup_by_id(
        db=db,
        pickup_id=pickup_id,
    )


@router.post(
    "/{pickup_id}/schedule",
    response_model=PickupAdminResponse,
)
def admin_schedule_pickup(
    pickup_id: int,
    data: PickupScheduleRequest,
    db: Session = Depends(get_db),
):
    return schedule_pickup(
        db=db,
        pickup_id=pickup_id,
        scheduled_date=data.scheduled_date,
    )


@router.post(
    "/{pickup_id}/cancel",
    response_model=PickupAdminResponse,
)
def admin_cancel_pickup(
    pickup_id: int,
    data: PickupCancelRequest,
    db: Session = Depends(get_db),
):
    return cancel_pickup(
        db=db,
        pickup_id=pickup_id,
        reason=data.reason,
    )