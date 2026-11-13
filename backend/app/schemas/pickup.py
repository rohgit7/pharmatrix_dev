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
    waste_categories: list[str] | None = None
    time_slot: str | None = Field(default=None, max_length=100)


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
    estimated_weight_kg: float | None = None
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


class PickupHandoverConfirmRequest(BaseModel):
    confirmed: bool = True
    notes: str | None = Field(default=None, max_length=1000)


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
    operational_state: str | None = None
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


class PickupMonitoringItem(BaseModel):
    id: int
    public_id: UUID
    pickup_code: str
    customer_id: int
    customer_name: str | None = None
    customer_type: str | None = None
    location_id: int
    location_name: str | None = None
    location_address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str
    priority: str
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    collected_at: datetime | None = None
    estimated_weight_kg: float | None = None
    collected_weight_kg: float | None = None
    driver_id: int | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    route_id: int | None = None
    route_code: str | None = None
    route_status: str | None = None
    payment_status: str = "PENDING"
    invoice_total: float | None = None
    has_exceptions: bool = False
    is_delayed: bool = False
    delay_reasons: list[str] = []
    current_stage: str
    progress_percent: int = 0
    created_at: datetime
    updated_at: datetime


class PickupMonitoringListResponse(BaseModel):
    items: list[PickupMonitoringItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    summary_counts: dict[str, int]


class PickupTimelineStage(BaseModel):
    stage_id: str
    name: str
    state: str  # COMPLETED, CURRENT, UPCOMING, FAILED, CANCELLED
    timestamp: datetime | None = None
    description: str
    actor: str | None = None
    metadata: dict | None = None


class PickupCustomerInfo(BaseModel):
    id: int
    display_name: str
    legal_name: str | None = None
    customer_type: str
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    location_id: int
    location_name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class PickupVehicleInfo(BaseModel):
    id: int
    registration_number: str
    model: str | None = None
    vehicle_type: str | None = None
    capacity_kg: float | None = None


class PickupDriverInfo(BaseModel):
    id: int | None = None
    employee_id: str | None = None
    name: str | None = None
    phone: str | None = None
    status: str | None = None
    assigned_at: datetime | None = None
    arrived_at: datetime | None = None
    vehicle: PickupVehicleInfo | None = None
    current_latitude: float | None = None
    current_longitude: float | None = None
    last_location_update: datetime | None = None
    distance_to_pickup_meters: float | None = None
    location_live: bool = False
    location_unavailable_reason: str | None = None


class PickupCollectionInfo(BaseModel):
    stop_id: int | None = None
    execution_status: str | None = None
    collection_start_time: datetime | None = None
    collection_completion_time: datetime | None = None
    estimated_weight_kg: float | None = None
    actual_collected_weight_kg: float | None = None
    weight_discrepancy_kg: float | None = None
    weight_discrepancy_percent: float | None = None
    waste_condition_remarks: str | None = None
    has_collection_proof: bool = False
    proof_url: str | None = None
    proof_uploaded_at: datetime | None = None
    qr_verified: bool = False
    qr_verified_at: datetime | None = None


class PickupPaymentInfo(BaseModel):
    invoice_id: int | None = None
    invoice_number: str | None = None
    invoice_status: str | None = None
    subtotal: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    amount_paid: float | None = None
    payment_status: str  # PAID, PENDING, FAILED, NOT_REQUIRED
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    payment_method: str | None = None
    payment_initiated_at: datetime | None = None
    payment_completed_at: datetime | None = None
    failure_details: str | None = None
    pricing_snapshot: dict | None = None
    line_items: list[dict] = []


class PickupOtpVerificationInfo(BaseModel):
    otp_generated: bool = False
    otp_expires_at: datetime | None = None
    verification_status: str  # VERIFIED, PENDING, EXPIRED, NOT_GENERATED
    verification_timestamp: datetime | None = None
    attempts_count: int = 0
    # Note: OTP string is strictly NEVER exposed


class PickupCompletionInfo(BaseModel):
    final_status: str
    completion_timestamp: datetime | None = None
    total_duration_minutes: int | None = None
    final_collected_weight_kg: float | None = None
    final_payment_status: str
    invoice_number: str | None = None
    facility_handover_status: str | None = None


class PickupEventItem(BaseModel):
    id: str
    event_type: str
    title: str
    description: str | None = None
    actor_type: str
    actor_id: int | None = None
    actor_name: str
    metadata: dict = {}
    created_at: datetime
    source: str


class PickupMonitoringDetailResponse(BaseModel):
    pickup_id: int
    public_id: UUID
    pickup_code: str
    status: str
    priority: str
    requested_date: datetime | None = None
    scheduled_date: datetime | None = None
    notes: str | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: PickupCustomerInfo
    driver: PickupDriverInfo | None = None
    route_id: int | None = None
    route_code: str | None = None
    route_status: str | None = None
    collection: PickupCollectionInfo
    payment: PickupPaymentInfo
    otp: PickupOtpVerificationInfo
    completion: PickupCompletionInfo
    timeline: list[PickupTimelineStage]
    progress_percent: int
    current_stage_name: str
    is_delayed: bool = False
    delay_reasons: list[str] = []
    exceptions: list[dict] = []
    events: list[PickupEventItem] = []
    server_time: datetime


class DriverLiveLocationResponse(BaseModel):
    driver_id: int | None = None
    driver_name: str | None = None
    phone: str | None = None
    current_latitude: float | None = None
    current_longitude: float | None = None
    last_location_update: datetime | None = None
    is_live: bool = False
    pickup_latitude: float | None = None
    pickup_longitude: float | None = None
    distance_meters: float | None = None
    vehicle_registration: str | None = None
    vehicle_model: str | None = None
    unavailable_reason: str | None = None


class PickupReassignDriverRequest(BaseModel):
    driver_id: int
    vehicle_id: int | None = None
    reason: str = Field(min_length=2, max_length=500)

