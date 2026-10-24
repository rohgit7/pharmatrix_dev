from datetime import datetime
from uuid import UUID
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
    public_id: UUID
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
    public_id: UUID
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
    
    # Enriched operational planning attributes
    estimated_weight_kg: float | None = None
    customer_name: str | None = None
    location_name: str | None = None
    location_address: str | None = None
    operational_state: str | None = None  # awaiting_selection, selected, optimized, awaiting_assignment, awaiting_dispatch, dispatched, collected
    route_id: int | None = None
    route_code: str | None = None
    route_status: str | None = None
    is_eligible_for_tomorrow: bool = True
    ineligibility_reason: str | None = None

    model_config = {
        "from_attributes": True
    }


class PickupAdminCreate(BaseModel):
    customer_id: int
    location_id: int
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    priority: PickupPriority = PickupPriority.NORMAL
    notes: str | None = Field(default=None, max_length=1000)
    estimated_weight_kg: float | None = Field(default=None, gt=0)


class PickupAdminUpdate(BaseModel):
    priority: PickupPriority | None = None
    status: PickupStatus | None = None
    scheduled_date: datetime | None = None
    requested_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)
    failure_reason: str | None = Field(default=None, max_length=1000)


class PickupHistoryItem(BaseModel):
    id: int
    public_id: UUID
    pickup_code: str
    customer_id: int
    customer_name: str | None = None
    location_id: int
    location_name: str | None = None
    location_address: str | None = None
    status: PickupStatus
    priority: PickupPriority
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    collected_at: datetime | None = None
    estimated_weight_kg: float | None = None
    collected_weight_kg: float | None = None
    failure_reason: str | None = None
    route_id: int | None = None
    route_code: str | None = None
    driver_id: int | None = None
    driver_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class PickupHistoryResponse(BaseModel):
    items: list[PickupHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int