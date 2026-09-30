from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.models.warehouse_intake import WarehouseIntake

from app.schemas.warehouse_intake import (
    WarehouseClassifyRequest,
    WarehouseIntakeResponse,
    WarehouseReceiveRequest,
)

from app.services.warehouse_intake_service import (
    classify_warehouse_intake,
    receive_warehouse_intake,
)

router = APIRouter(
    prefix="/api/admin/warehouse-intakes",
    tags=["Admin - Warehouse Intake"],
    dependencies=[
        Depends(require_role(UserRole.ADMIN))
    ],
)

@router.post(
    "/{intake_id}/classify",
    response_model=WarehouseIntakeResponse,
)
def classify_warehouse_intake_endpoint(
    intake_id: int,
    data: WarehouseClassifyRequest,
    db: Session = Depends(get_db),
):
    return classify_warehouse_intake(
        db=db,
        intake_id=intake_id,
        items=data.items,
    )

@router.get(
    "/{intake_id}",
    response_model=WarehouseIntakeResponse,
)
def get_warehouse_intake(
    intake_id: int,
    db: Session = Depends(get_db),
):
    intake = (
        db.query(WarehouseIntake)
        .options(
            joinedload(WarehouseIntake.items)
        )
        .filter(
            WarehouseIntake.id == intake_id
        )
        .first()
    )

    if not intake:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Warehouse intake not found",
        )

    return intake


@router.post(
    "/{intake_id}/receive",
    response_model=WarehouseIntakeResponse,
)
def receive_warehouse_intake_endpoint(
    intake_id: int,
    data: WarehouseReceiveRequest,
    db: Session = Depends(get_db),
):
    return receive_warehouse_intake(
        db=db,
        intake_id=intake_id,
        received_weight_kg=data.received_weight_kg,
        discrepancy_reason=data.discrepancy_reason,
        notes=data.notes,
    )