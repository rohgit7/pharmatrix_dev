from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import require_role
from app.core.database import get_db

from app.models.disposal_shipment import DisposalShipment
from app.models.enums import DisposalShipmentStatus
from app.models.facility import Facility
from app.models.user import UserRole

from app.schemas.disposal_shipment import (
    DisposalShipmentReceiveRequest,
    DisposalShipmentResponse,
)

from app.services.disposal_shipment_service import (
    receive_disposal_shipment,
)


router = APIRouter(
    prefix="/api/facility/disposal-shipments",
    tags=["Facility Disposal Shipments"],
)


@router.get(
    "/",
    response_model=list[DisposalShipmentResponse],
)
def list_incoming_shipments(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.FACILITY)),
):
    facility = db.scalar(
        select(Facility)
        .where(Facility.user_id == current_user.id)
    )

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility profile not found",
        )

    shipments = db.scalars(
        select(DisposalShipment)
        .where(
            DisposalShipment.facility_id == facility.id,
            DisposalShipment.status.in_([
                DisposalShipmentStatus.IN_TRANSIT,
                DisposalShipmentStatus.RECEIVED,
                DisposalShipmentStatus.DISCREPANCY,
            ]),
        )
        .options(joinedload(DisposalShipment.items))
        .order_by(DisposalShipment.created_at.desc())
    ).unique().all()

    return shipments


@router.post(
    "/{shipment_id}/receive",
    response_model=DisposalShipmentResponse,
)
def receive_shipment(
    shipment_id: int,
    payload: DisposalShipmentReceiveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.FACILITY)),
):
    facility = db.scalar(
        select(Facility)
        .where(Facility.user_id == current_user.id)
    )

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility profile not found",
        )

    shipment = db.scalar(
        select(DisposalShipment)
        .where(
            DisposalShipment.id == shipment_id,
            DisposalShipment.facility_id == facility.id,
        )
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    shipment = receive_disposal_shipment(
        db=db,
        shipment_id=shipment_id,
        received_items=[
            {
                "shipment_item_id": item.shipment_item_id,
                "received_weight_kg": item.received_weight_kg,
            }
            for item in payload.items
        ],
        notes=payload.notes,
    )

    db.commit()
    db.refresh(shipment)

    return shipment