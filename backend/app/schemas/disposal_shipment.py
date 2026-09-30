from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import DisposalShipmentStatus


class DisposalShipmentItemCreate(BaseModel):
    warehouse_intake_item_id: int
    expected_weight_kg: Decimal = Field(gt=0)


class DisposalShipmentCreate(BaseModel):
    intake_id: int
    facility_id: int
    items: list[DisposalShipmentItemCreate]
    notes: str | None = None


class DisposalShipmentItemResponse(BaseModel):
    id: int
    warehouse_intake_item_id: int
    expected_weight_kg: Decimal
    received_weight_kg: Decimal | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class DisposalShipmentResponse(BaseModel):
    id: int
    shipment_code: str
    intake_id: int
    facility_id: int
    status: DisposalShipmentStatus
    expected_weight_kg: Decimal
    received_weight_kg: Decimal | None = None
    dispatched_at: datetime | None = None
    received_at: datetime | None = None
    discrepancy_reason: str | None = None
    notes: str | None = None
    items: list[DisposalShipmentItemResponse] = []

    model_config = {"from_attributes": True}


class DisposalShipmentReceiveItem(BaseModel):
    shipment_item_id: int
    received_weight_kg: Decimal = Field(ge=0)


class DisposalShipmentReceiveRequest(BaseModel):
    items: list[DisposalShipmentReceiveItem]
    notes: str | None = None