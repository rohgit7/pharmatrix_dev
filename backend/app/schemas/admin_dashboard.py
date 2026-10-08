from pydantic import BaseModel


class AdminDashboardSummary(BaseModel):
    total_pickups: int
    pending_pickups: int
    today_scheduled_pickups: int
    active_routes: int
    pending_warehouse_intakes: int
    open_exceptions: int
    total_collected_weight_kg: float