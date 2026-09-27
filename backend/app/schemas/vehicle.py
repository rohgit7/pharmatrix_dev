from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import VehicleStatus, VehicleType


class VehicleCreate(BaseModel):
    registration_number: str = Field(min_length=1, max_length=50)
    vehicle_type: VehicleType
    capacity_kg: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class VehicleUpdate(BaseModel):
    registration_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )
    vehicle_type: VehicleType | None = None
    capacity_kg: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
    )
    status: VehicleStatus | None = None


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration_number: str
    vehicle_type: VehicleType
    capacity_kg: Decimal
    status: VehicleStatus
    created_at: datetime
    updated_at: datetime