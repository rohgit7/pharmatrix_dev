from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from sqlalchemy import select

from app.models.disposal_shipment import DisposalShipment
from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.disposal_shipment import (
    DisposalShipmentCreate,
    DisposalShipmentResponse,
    DisposalShipmentUpdate,
)
from app.services.disposal_shipment_service import (
    create_disposal_shipment,
    dispatch_disposal_shipment,
)

router = APIRouter(
    prefix="/api/admin/disposal-shipments",
    tags=["Admin Disposal Shipments"],
)


def _find_disposal_shipment(db: Session, shipment_id: str) -> DisposalShipment | None:
    query = db.query(DisposalShipment).options(joinedload(DisposalShipment.items))
    try:
        val_uuid = UUID(str(shipment_id))
        shipment = query.filter(DisposalShipment.public_id == val_uuid).first()
        if shipment:
            return shipment
    except (ValueError, AttributeError):
        pass

    try:
        val_int = int(shipment_id)
        shipment = query.filter(DisposalShipment.id == val_int).first()
        if shipment:
            return shipment
    except (ValueError, TypeError):
        pass

    return query.filter(DisposalShipment.shipment_code == str(shipment_id)).first()


@router.get(
    "",
    response_model=list[DisposalShipmentResponse],
)
def list_disposal_shipments(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    query = (
        db.query(DisposalShipment)
        .options(joinedload(DisposalShipment.items))
        .order_by(DisposalShipment.created_at.desc())
    )
    return query.offset(offset).limit(limit).all()


@router.get(
    "/{shipment_id}",
    response_model=DisposalShipmentResponse,
)
def get_disposal_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    shipment = _find_disposal_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )
    return shipment


@router.post(
    "/",
    response_model=DisposalShipmentResponse,
)
def create_shipment(
    payload: DisposalShipmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    shipment = create_disposal_shipment(
        db=db,
        intake_id=payload.intake_id,
        facility_id=payload.facility_id,
        items=[
            {
                "warehouse_intake_item_id": item.warehouse_intake_item_id,
                "expected_weight_kg": item.expected_weight_kg,
            }
            for item in payload.items
        ],
        notes=payload.notes,
    )

    db.commit()
    db.refresh(shipment)

    return shipment


@router.patch(
    "/{shipment_id}",
    response_model=DisposalShipmentResponse,
)
def update_shipment(
    shipment_id: str,
    payload: DisposalShipmentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    shipment = _find_disposal_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    update_dict = payload.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(shipment, field, value)

    db.commit()
    db.refresh(shipment)
    return shipment


@router.post(
    "/{shipment_id}/dispatch",
    response_model=DisposalShipmentResponse,
)
def dispatch_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    shipment = dispatch_disposal_shipment(
        db=db,
        shipment_id=shipment_id,
    )

    db.commit()
    db.refresh(shipment)

    return shipment


@router.delete(
    "/{shipment_id}",
    status_code=status.HTTP_200_OK,
)
def delete_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    shipment = _find_disposal_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    db.delete(shipment)
    db.commit()
    return {"message": "Disposal shipment removed successfully"}
