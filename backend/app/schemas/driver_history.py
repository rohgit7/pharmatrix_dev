from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class DriverPerformanceSummary(BaseModel):
    completed_this_week: int = 0
    completed_this_month: int = 0
    collected_weight_this_month_kg: float = 0.0
    completion_rate_percentage: float = 0.0
    avg_collection_duration_minutes: float | None = None
    total_distance_km: float = 0.0


class DriverWorkSummaryResponse(BaseModel):
    total_pickups: int = 0
    completed_pickups: int = 0
    cancelled_pickups: int = 0
    failed_pickups: int = 0
    in_progress_pickups: int = 0
    total_collected_weight_kg: float = 0.0
    total_working_days: int = 0
    avg_pickups_per_day: float = 0.0
    performance: DriverPerformanceSummary = DriverPerformanceSummary()


class DriverPickupHistoryItem(BaseModel):
    id: int
    public_id: UUID
    pickup_code: str
    status: str
    priority: str
    customer_id: int
    customer_name: str
    customer_type: str
    location_id: int
    location_name: str
    address: str
    city: str
    postal_code: str
    route_id: int | None = None
    route_code: str | None = None
    route_date: datetime | None = None
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    completed_at: datetime | None = None
    estimated_weight_kg: float | None = None
    collected_weight_kg: float | None = None
    has_proof: bool = False
    qr_verified: bool = False
    otp_verified: bool = False
    failure_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DriverPickupHistoryListResponse(BaseModel):
    items: list[DriverPickupHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class TimelineEvent(BaseModel):
    stage: str
    label: str
    description: str | None = None
    timestamp: datetime
    status: str = "completed"


class OperationalExceptionItem(BaseModel):
    id: int
    exception_type: str
    status: str
    created_at: datetime


class DriverPickupDetailResponse(BaseModel):
    id: int
    public_id: UUID
    pickup_code: str
    status: str
    priority: str
    customer_id: int
    customer_name: str
    customer_type: str
    location_id: int
    location_name: str
    address: str
    address_line_1: str
    address_line_2: str | None = None
    city: str
    state: str
    postal_code: str
    contact_name: str | None = None
    contact_phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    route_id: int | None = None
    route_code: str | None = None
    route_date: datetime | None = None
    route_status: str | None = None
    vehicle_registration_number: str | None = None
    warehouse_name: str | None = None
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    arrived_at: datetime | None = None
    completed_at: datetime | None = None
    estimated_weight_kg: float | None = None
    collected_weight_kg: float | None = None
    weight_discrepancy_kg: float | None = None
    notes: str | None = None
    failure_reason: str | None = None
    qr_verified: bool = False
    qr_verified_at: datetime | None = None
    otp_verified: bool = False
    otp_verified_at: datetime | None = None
    has_proof: bool = False
    proof_uploaded_at: datetime | None = None
    proof_storage_path: str | None = None
    proof_signed_url: str | None = None
    exceptions: list[OperationalExceptionItem] = []
    timeline: list[TimelineEvent] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

