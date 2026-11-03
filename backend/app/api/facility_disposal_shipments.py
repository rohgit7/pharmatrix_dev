from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from app.core.auth import require_role
from app.core.database import get_db

from app.models.disposal_shipment import DisposalShipment
from app.models.enums import DisposalShipmentStatus
from app.models.facility import Facility
from app.models.user import UserRole

from app.schemas.disposal_shipment import (
    DisposalShipmentDisposalRecordRequest,
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


def _find_facility_shipment(db: Session, shipment_id: str | UUID) -> DisposalShipment | None:
    try:
        val_uuid = shipment_id if isinstance(shipment_id, UUID) else UUID(str(shipment_id))
        shipment = db.scalar(
            select(DisposalShipment)
            .options(joinedload(DisposalShipment.items))
            .where(DisposalShipment.public_id == val_uuid)
        )
        if shipment:
            return shipment
    except (ValueError, AttributeError):
        pass

    try:
        val_int = int(str(shipment_id))
        shipment = db.scalar(
            select(DisposalShipment)
            .options(joinedload(DisposalShipment.items))
            .where(DisposalShipment.id == val_int)
        )
        if shipment:
            return shipment
    except (ValueError, TypeError):
        pass

    return db.scalar(
        select(DisposalShipment)
        .options(joinedload(DisposalShipment.items))
        .where(DisposalShipment.shipment_code == str(shipment_id))
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
                DisposalShipmentStatus.DISPOSED,
            ]),
        )
        .options(joinedload(DisposalShipment.items))
        .order_by(DisposalShipment.created_at.desc())
    ).unique().all()

    return shipments


@router.get(
    "/{shipment_id}",
    response_model=DisposalShipmentResponse,
)
def get_facility_shipment(
    shipment_id: str,
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

    shipment = _find_facility_shipment(db, shipment_id)

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.facility_id != facility.id:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Shipment belongs to another facility",
        )

    return shipment


@router.post(
    "/{shipment_id}/receive",
    response_model=DisposalShipmentResponse,
)
def receive_shipment(
    shipment_id: str,
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

    shipment = _find_facility_shipment(db, shipment_id)

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.facility_id != facility.id:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Shipment belongs to another facility",
        )

    # Enforce shipment lifecycle state
    if shipment.status != DisposalShipmentStatus.IN_TRANSIT:
        if shipment.status in (DisposalShipmentStatus.RECEIVED, DisposalShipmentStatus.DISCREPANCY):
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate receipt: Shipment {shipment.shipment_code} has already been received (status: {shipment.status.value})",
            )
        elif shipment.status == DisposalShipmentStatus.CREATED:
            raise HTTPException(
                status_code=409,
                detail=f"Shipment {shipment.shipment_code} is not in transit (current status: CREATED). It must be dispatched by the warehouse/admin before it can be received.",
            )
        else:
            raise HTTPException(
                status_code=409,
                detail=f"Shipment is not in transit: Current status is {shipment.status.value}",
            )

    shipment = receive_disposal_shipment(
        db=db,
        shipment_id=shipment.id,
        received_items=[
            {
                "shipment_item_id": item.shipment_item_id,
                "received_weight_kg": item.received_weight_kg,
            }
            for item in payload.items
        ],
        notes=payload.notes,
    )

    if payload.discrepancy_reason:
        shipment.discrepancy_reason = payload.discrepancy_reason

    item_notes_map = {
        item.shipment_item_id: item.notes
        for item in payload.items
        if item.notes
    }
    if item_notes_map and getattr(shipment, "items", None):
        for s_item in shipment.items:
            if s_item.id in item_notes_map:
                s_item.notes = item_notes_map[s_item.id]

    db.commit()
    db.refresh(shipment)

    return shipment


@router.post(
    "/{shipment_id}/disposal",
    response_model=DisposalShipmentResponse,
)
def record_shipment_disposal(
    shipment_id: str,
    payload: DisposalShipmentDisposalRecordRequest,
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

    shipment = _find_facility_shipment(db, shipment_id)

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.facility_id != facility.id:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Shipment belongs to another facility",
        )

    if shipment.status not in (
        DisposalShipmentStatus.RECEIVED,
        DisposalShipmentStatus.DISCREPANCY,
        DisposalShipmentStatus.DISPOSED,
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Shipment {shipment.shipment_code} must be received before recording disposal (current status: {shipment.status.value})",
        )

    method_part = f" | Method: {payload.disposal_method.strip()}" if payload.disposal_method and payload.disposal_method.strip() else ""
    remarks_part = f" | Remarks: {payload.notes.strip()}" if payload.notes and payload.notes.strip() else ""
    disposal_log = (
        f"[Disposal Record] Date: {payload.disposal_date.strftime('%Y-%m-%d %H:%M UTC')} | "
        f"Disposed Weight: {payload.disposed_weight_kg:.2f} kg{method_part}{remarks_part}"
    )

    if shipment.notes:
        # Replace previous [Disposal Record] line if updating, or append
        lines = [line for line in shipment.notes.splitlines() if not line.startswith("[Disposal Record]")]
        lines.append(disposal_log)
        shipment.notes = "\n".join(lines)
    else:
        shipment.notes = disposal_log

    if payload.mark_disposed:
        shipment.status = DisposalShipmentStatus.DISPOSED

    db.commit()
    db.refresh(shipment)

    return shipment
