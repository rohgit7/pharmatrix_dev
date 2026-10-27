from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.models.enums import RouteStatus, RouteStopType, RouteStopStatus



class DriverRouteStopResponse(BaseModel):
    id: int | None = None
    sequence_number: int
    stop_type: RouteStopType

    pickup_id: UUID | None = None
    pickup_code: str | None = None

    location_id: int | None = None
    location_name: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    estimated_weight_kg: float | None = None
    collected_weight_kg: float | None = None

    warehouse_id: int | None = None
    warehouse_name: str | None = None

    arrival_time: datetime | None = None
    departure_time: datetime | None = None
    proof_uploaded: bool
    qr_verified: bool = False
    otp_verified: bool = False
    execution_status: RouteStopStatus
    failure_reason: str | None = None
    notes: str | None = None


class DriverRouteResponse(BaseModel):
    id: int
    route_code: str
    route_date: datetime
    status: RouteStatus
   
    vehicle_id: int | None = None
    vehicle_registration_number: str | None = None
    vehicle_capacity_kg: float | None = None
    vehicle_type: str | None = None

    warehouse_id: int
    warehouse_name: str
    warehouse_address: str
    warehouse_city: str
    warehouse_state: str
    warehouse_latitude: float
    warehouse_longitude: float

    planned_distance_km: float | None = None
    planned_duration_seconds: int | None = None

    stops: list[DriverRouteStopResponse]

    model_config = {
        "from_attributes": True
    }