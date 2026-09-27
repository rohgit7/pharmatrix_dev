from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import RouteStatus, RouteStopType


class RouteCreate(BaseModel):
    warehouse_id: int
    route_date: datetime
    pickup_ids: list[int] = Field(min_length=1)


class RouteStopResponse(BaseModel):
    id: int
    sequence_number: int
    stop_type: RouteStopType
    pickup_id: int | None
    warehouse_id: int | None
    arrival_time: datetime | None
    departure_time: datetime | None

    model_config = {
        "from_attributes": True
    }


class RouteResponse(BaseModel):
    id: int
    route_code: str
    route_date: datetime
    warehouse_id: int
    driver_id: int | None
    vehicle_id: int | None
    status: RouteStatus
    planned_distance_km: float | None
    planned_duration_seconds: int | None
    optimized_at: datetime | None
    created_at: datetime
    updated_at: datetime
    stops: list[RouteStopResponse] = []

    model_config = {
        "from_attributes": True
    }