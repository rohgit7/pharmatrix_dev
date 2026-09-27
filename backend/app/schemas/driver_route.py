from datetime import datetime

from pydantic import BaseModel

from app.models.enums import RouteStatus, RouteStopType, RouteStopStatus



class DriverRouteStopResponse(BaseModel):
    sequence_number: int
    stop_type: RouteStopType

    pickup_id: int | None = None
    pickup_code: str | None = None

    location_id: int | None = None
    location_name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    warehouse_id: int | None = None
    warehouse_name: str | None = None

    arrival_time: datetime | None = None
    departure_time: datetime | None = None

    execution_status: RouteStopStatus


class DriverRouteResponse(BaseModel):
    id: int
    route_code: str
    route_date: datetime
    status: RouteStatus

    vehicle_id: int | None = None
    vehicle_registration_number: str | None = None

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