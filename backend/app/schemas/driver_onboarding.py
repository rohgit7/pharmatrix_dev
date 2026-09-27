from datetime import date

from pydantic import BaseModel, EmailStr, Field


class DriverOnboardRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=150)

    employee_id: str = Field(
        min_length=1,
        max_length=50,
    )

    phone: str = Field(
        min_length=1,
        max_length=20,
    )

    license_number: str = Field(
        min_length=1,
        max_length=100,
    )

    license_expiry: date | None = None


class DriverOnboardResponse(BaseModel):
    driver_id: int
    user_id: int
    auth_user_id: str
    message: str