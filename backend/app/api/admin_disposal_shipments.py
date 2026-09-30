from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.disposal_shipment import (
    DisposalShipmentCreate,
    DisposalShipmentResponse,
)
from app.services.disposal_shipment_service import (
    create_disposal_shipment,
    dispatch_disposal_shipment,
)

router = APIRouter(
    prefix="/api/admin/disposal-shipments",
    tags=["Admin Disposal Shipments"],
)


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


@router.post(
    "/{shipment_id}/dispatch",
    response_model=DisposalShipmentResponse,
)
def dispatch_shipment(
    shipment_id: int,
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