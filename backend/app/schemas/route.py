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
    lat: float | None = None
    lng: float | None = None
    location_name: str | None = None
    address: str | None = None
    estimated_weight_kg: float | None = None
    execution_status: str | None = None

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
    approved_at: datetime | None = None
    approved_by_id: int | None = None
    optimization_run_id: int | None = None
    created_at: datetime
    updated_at: datetime
    stops: list[RouteStopResponse] = []
    
    # Workflow metadata
    is_approved: bool = False
    planning_date: str | None = None
    prerequisites: list[str] = []
    next_permitted_action: str | None = None
    blockers: list[str] = []

    model_config = {
        "from_attributes": True
    }


class RouteApproveRequest(BaseModel):
    notes: str | None = None


class RouteBulkApproveRequest(BaseModel):
    route_ids: list[int] = Field(min_length=1)


class RouteBulkApproveItem(BaseModel):
    route_id: int
    success: bool
    error: str | None = None


class RouteBulkApproveResponse(BaseModel):
    approved_count: int
    failed_count: int
    results: list[RouteBulkApproveItem]


class RouteReassignRequest(BaseModel):
    driver_id: int
    vehicle_id: int
    reason: str = Field(min_length=1, max_length=1000)


class RouteReleasePickupRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class RouteUpdate(BaseModel):
    driver_id: int | None = None
    vehicle_id: int | None = None
    status: RouteStatus | None = None
    route_date: datetime | None = None


class RouteAssignRequest(BaseModel):
    driver_id: int
    vehicle_id: int
    notes: str | None = None


class RouteBulkDispatchRequest(BaseModel):
    route_ids: list[int] = Field(min_length=1)


class RouteBulkDispatchItem(BaseModel):
    route_id: int
    success: bool
    status: str
    error: str | None = None


class RouteBulkDispatchResponse(BaseModel):
    dispatched_count: int
    failed_count: int
    results: list[RouteBulkDispatchItem]


class RouteHistoryItem(BaseModel):
    id: int
    route_code: str
    route_date: datetime
    planning_date: str
    warehouse_id: int
    warehouse_name: str | None = None
    driver_id: int | None = None
    driver_name: str | None = None
    vehicle_id: int | None = None
    vehicle_registration: str | None = None
    status: RouteStatus
    planned_distance_km: float | None = None
    planned_duration_seconds: int | None = None
    stops_count: int = 0
    pickups_count: int = 0
    total_load_kg: float | None = None
    approved_at: datetime | None = None
    optimized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class RouteHistoryResponse(BaseModel):
    items: list[RouteHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int