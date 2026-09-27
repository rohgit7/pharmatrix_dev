from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DriverVehicleAssignRequest(BaseModel):
    driver_id: int
    vehicle_id: int
    notes: str | None = None


class DriverVehicleAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    driver_id: int
    vehicle_id: int
    assigned_at: datetime
    unassigned_at: datetime | None
    notes: str | None