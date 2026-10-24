from datetime import datetime, date
from pydantic import BaseModel


class OptimizeRoutesRequest(BaseModel):
    warehouse_id: int
    route_date: datetime
    batch_id: int | None = None
    num_vehicles: int | None = None
    vehicle_capacity_kg: float | None = None
    max_distance_km: float | None = None
    max_duration_minutes: float | None = None
    service_time_minutes: float | None = None
    local_backward_allowance_km: float | None = None
    selected_pickup_ids: list[int] | None = None
    auto_dispatch: bool = False
    rerun: bool = False  # Explicit authorization to supersede existing unapproved draft routes


class OptimizationBatchCreate(BaseModel):
    warehouse_id: int
    planning_date: date | datetime | str | None = None
    pickup_ids: list[int]


class OptimizationBatchResponse(BaseModel):
    batch_id: int
    batch_code: str
    planning_date: str
    warehouse_id: int
    status: str
    pickup_count: int
    pickup_ids: list[int]
    created_at: str
    created_by_id: int | None = None
    routes_created: int = 0


class OptimizationBatchDetailResponse(BaseModel):
    batch_id: int
    batch_code: str
    planning_date: str
    warehouse_id: int
    status: str
    pickup_count: int
    pickup_ids: list[int]
    created_at: str
    created_by_id: int | None = None
    routes_created: int = 0
    pickups: list[dict] = []
    routes: list[dict] = []
    summary_metrics: dict | None = None


class RouteRejectRequest(BaseModel):
    reason: str | None = None


class UnassignedPickupInfo(BaseModel):
    pickup_id: int
    reason: str


class ExcludedPickupInfo(BaseModel):
    pickup_id: int
    pickup_code: str
    customer_id: int
    customer_name: str | None = None
    scheduled_date: str | None = None
    reason: str


class OptimizedStopLocation(BaseModel):
    """Carry enough location detail for the frontend map — returned in the
    optimize response so the frontend can render the routes immediately."""

    pickup_id: int
    sequence_number: int
    location_name: str
    lat: float
    lng: float
    estimated_weight_kg: float | None = None


class OptimizedRouteSummary(BaseModel):
    route_id: int
    route_code: str
    driver_id: int | None = None
    vehicle_id: int | None = None
    pickup_ids: list[int]
    distance_km: float
    duration_minutes: float
    load_kg: float
    stop_locations: list[OptimizedStopLocation] = []
    polyline: list[list[float]] = []
    backtrack_km: float = 0.0
    status: str = "DRAFT"
    is_approved: bool = False


class OptimizeRoutesResponse(BaseModel):
    route_date: datetime
    planning_date: str = ""
    warehouse_id: int
    warehouse_coordinates: list[float] = []
    vehicles_available: int
    routes_created: int
    pickups_assigned: int
    unassigned_pickups: list[UnassignedPickupInfo] = []
    total_fleet_distance_km: float = 0.0
    max_route_duration_minutes: float = 0.0
    vehicle_utilization_pct: float = 0.0
    cross_vehicle_overlap_km: float = 0.0
    routes: list[OptimizedRouteSummary]
    routing_source: str = "UNKNOWN"
    optimization_run_id: int | None = None
    optimization_run_code: str | None = None


class PlanningReadinessResponse(BaseModel):
    planning_date: str
    timezone: str
    total_pickups_requested_tomorrow: int
    eligible_pickups_awaiting_selection: int
    pickups_allocated_to_routes: int
    pickups_excluded_count: int
    pickups_excluded: list[ExcludedPickupInfo] = []
    routes_awaiting_review: int
    routes_awaiting_assignment: int
    routes_awaiting_dispatch: int
    total_demand_kg: float
    available_fleet_capacity_kg: float
    capacity_shortfall_kg: float
    is_ready_for_dispatch: bool
    blockers: list[str] = []
    latest_run: dict | None = None


class OptimizationRunSummary(BaseModel):
    id: int
    run_code: str
    planning_date: datetime
    warehouse_id: int
    status: str
    routes_created: int
    pickups_assigned: int
    created_at: datetime
    unassigned_count: int = 0

    model_config = {
        "from_attributes": True
    }
