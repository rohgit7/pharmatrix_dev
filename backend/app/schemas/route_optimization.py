from datetime import datetime

from pydantic import BaseModel


class OptimizeRoutesRequest(BaseModel):
    warehouse_id: int
    route_date: datetime


class OptimizedRouteSummary(BaseModel):
    route_id: int
    route_code: str
    driver_id: int
    vehicle_id: int
    pickup_ids: list[int]
    distance_km: float
    duration_minutes: float
    load_kg: float


class OptimizeRoutesResponse(BaseModel):
    route_date: datetime
    warehouse_id: int
    vehicles_available: int
    routes_created: int
    pickups_assigned: int
    routes: list[OptimizedRouteSummary]
