from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import (
    WasteBinColor,
    WasteType,
    WarehouseIntakeStatus,
)


class WarehouseIntakeItemRequest(BaseModel):
    bin_color: WasteBinColor
    waste_type: WasteType

    expected_weight_kg: float = Field(
        gt=0,
        le=100000,
    )

    received_weight_kg: float = Field(
        gt=0,
        le=100000,
    )

    notes: str | None = Field(
        default=None,
        max_length=1000,
    )


class WarehouseIntakeItemResponse(BaseModel):
    id: int
    intake_id: int
    bin_color: WasteBinColor
    waste_type: WasteType
    expected_weight_kg: float
    received_weight_kg: float | None
    notes: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class WarehouseClassifyRequest(BaseModel):
    items: list[WarehouseIntakeItemRequest] = Field(
        min_length=1,
    )

class WarehouseReceiveRequest(BaseModel):
    received_weight_kg: float = Field(
        gt=0,
        le=100000,
    )

    discrepancy_reason: str | None = Field(
        default=None,
        max_length=1000,
    )

    notes: str | None = Field(
        default=None,
        max_length=1000,
    )
    
class WarehouseIntakeResponse(BaseModel):
    id: int
    intake_code: str

    route_id: int
    warehouse_id: int
    driver_id: int
    vehicle_id: int

    status: WarehouseIntakeStatus

    expected_weight_kg: float
    received_weight_kg: float | None

    received_at: datetime | None
    discrepancy_reason: str | None
    notes: str | None

    created_at: datetime
    updated_at: datetime

    items: list[WarehouseIntakeItemResponse] = []

    model_config = {
        "from_attributes": True
    }