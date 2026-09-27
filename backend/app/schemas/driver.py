from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DriverStatus

from datetime import date, datetime

from pydantic import BaseModel


class DriverMeResponse(BaseModel):
    id: int
    user_id: int
    employee_id: str
    name: str
    email: str
    phone: str
    license_number: str
    license_expiry: date | None
    status: str
    is_available: bool
    created_at: datetime


class DriverCreate(BaseModel):
    user_id: int
    employee_id: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=1, max_length=20)
    license_number: str = Field(min_length=1, max_length=100)
    license_expiry: date | None = None


class DriverUpdate(BaseModel):
    employee_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )
    phone: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )
    license_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    license_expiry: date | None = None
    status: DriverStatus | None = None
    is_available: bool | None = None


class DriverResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    employee_id: str
    phone: str
    license_number: str
    license_expiry: date | None
    status: DriverStatus
    is_available: bool
    created_at: datetime
    updated_at: datetime