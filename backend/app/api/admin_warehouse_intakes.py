from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.models.warehouse_intake import WarehouseIntake

from app.models.enums import WarehouseIntakeStatus
from app.schemas.warehouse_intake import (
    WarehouseClassifyRequest,
    WarehouseIntakeCreate,
    WarehouseIntakeResponse,
    WarehouseIntakeUpdate,
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

@router.get(
    "",
    response_model=list[WarehouseIntakeResponse],
)
def list_warehouse_intakes_endpoint(
    warehouse_id: int | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        db.query(WarehouseIntake)
        .options(joinedload(WarehouseIntake.items))
        .order_by(WarehouseIntake.id.desc())
    )
    if warehouse_id is not None:
        query = query.filter(WarehouseIntake.warehouse_id == warehouse_id)
    if status is not None:
        query = query.filter(WarehouseIntake.status == status)
    return query.offset(offset).limit(limit).all()


@router.post(
    "/",
    response_model=WarehouseIntakeResponse,
    status_code=201,
)
def create_warehouse_intake_endpoint(
    data: WarehouseIntakeCreate,
    db: Session = Depends(get_db),
):
    import uuid
    code = f"WI-{uuid.uuid4().hex[:8].upper()}"
    intake = WarehouseIntake(
        intake_code=code,
        route_id=data.route_id,
        warehouse_id=data.warehouse_id,
        driver_id=data.driver_id,
        vehicle_id=data.vehicle_id,
        status=WarehouseIntakeStatus.PENDING_RECEIPT,
        expected_total_weight_kg=data.expected_weight_kg,
        notes=data.notes,
    )
    db.add(intake)
    db.commit()
    db.refresh(intake)
    return intake


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


@router.patch(
    "/{intake_id}",
    response_model=WarehouseIntakeResponse,
)
def update_warehouse_intake_endpoint(
    intake_id: int,
    data: WarehouseIntakeUpdate,
    db: Session = Depends(get_db),
):
    intake = db.query(WarehouseIntake).filter(WarehouseIntake.id == intake_id).first()
    if not intake:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Warehouse intake not found")

    update_dict = data.model_dump(exclude_unset=True)
    if "received_weight_kg" in update_dict:
        intake.received_total_weight_kg = update_dict.pop("received_weight_kg")
    for field, value in update_dict.items():
        setattr(intake, field, value)

    db.commit()
    db.refresh(intake)
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


@router.delete(
    "/{intake_id}",
    status_code=200,
)
def delete_warehouse_intake_endpoint(
    intake_id: int,
    db: Session = Depends(get_db),
):
    intake = db.query(WarehouseIntake).filter(WarehouseIntake.id == intake_id).first()
    if not intake:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Warehouse intake not found")

    db.delete(intake)
    db.commit()
    return {"message": "Warehouse intake removed successfully"}