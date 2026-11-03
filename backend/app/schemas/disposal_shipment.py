from datetime import datetime
from decimal import Decimal
from uuid import UUID
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
    bin_color: str | None = None
    waste_type: str | None = None

    model_config = {"from_attributes": True}


class DisposalShipmentResponse(BaseModel):
    id: int
    public_id: UUID
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
    created_at: datetime | None = None
    updated_at: datetime | None = None
    intake_code: str | None = None
    warehouse_id: int | None = None
    warehouse_code: str | None = None
    warehouse_name: str | None = None
    warehouse_city: str | None = None
    warehouse_address: str | None = None
    route_code: str | None = None
    vehicle_registration: str | None = None
    pickup_count: int = 0
    pickups_summary: list[dict] = []
    certificate_info: dict | None = None
    items: list[DisposalShipmentItemResponse] = []

    model_config = {"from_attributes": True}


class DisposalShipmentReceiveItem(BaseModel):
    shipment_item_id: int
    received_weight_kg: Decimal = Field(ge=0)
    notes: str | None = None


class DisposalShipmentReceiveRequest(BaseModel):
    items: list[DisposalShipmentReceiveItem]
    notes: str | None = None
    discrepancy_reason: str | None = None


class DisposalShipmentDisposalRecordRequest(BaseModel):
    disposal_date: datetime
    disposed_weight_kg: Decimal = Field(gt=0)
    disposal_method: str | None = None
    notes: str | None = None
    mark_disposed: bool = True


class DisposalShipmentUpdate(BaseModel):
    status: DisposalShipmentStatus | None = None
    notes: str | None = None
    discrepancy_reason: str | None = None
    received_weight_kg: Decimal | None = None
