from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import PickupPriority, PickupStatus


class PickupCreate(BaseModel):
    location_id: int
    requested_date: datetime | None = None
    priority: PickupPriority = PickupPriority.NORMAL
    notes: str | None = Field(default=None, max_length=1000)
    estimated_weight_kg: float | None = Field(
        default=None,
        gt=0,
    )


class PickupResponse(BaseModel):
    id: int
    pickup_code: str
    customer_id: int
    location_id: int
    status: PickupStatus
    priority: PickupPriority
    requested_date: datetime | None
    scheduled_date: datetime | None
    notes: str | None
    failure_reason: str | None
    collected_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

class PickupScheduleRequest(BaseModel):
    scheduled_date: datetime


class PickupCancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)

class PickupAdminResponse(BaseModel):
    id: int
    pickup_code: str
    customer_id: int
    location_id: int
    status: PickupStatus
    priority: PickupPriority
    requested_date: datetime | None
    scheduled_date: datetime | None
    notes: str | None
    failure_reason: str | None
    collected_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }