from datetime import datetime

from pydantic import BaseModel, Field


class FacilityCreate(BaseModel):
    user_id: int

    facility_code: str = Field(
        min_length=1,
        max_length=50,
    )

    legal_name: str = Field(
        min_length=1,
        max_length=200,
    )

    phone: str = Field(
        min_length=1,
        max_length=20,
    )

    email: str = Field(
        min_length=1,
        max_length=255,
    )

    license_number: str = Field(
        min_length=1,
        max_length=100,
    )

    license_expiry: datetime | None = None

    address: str = Field(
        min_length=1,
        max_length=500,
    )

    city: str = Field(
        min_length=1,
        max_length=100,
    )

    state: str = Field(
        min_length=1,
        max_length=100,
    )

    postal_code: str = Field(
        min_length=1,
        max_length=20,
    )

    latitude: float
    longitude: float


class FacilityUpdate(BaseModel):
    facility_code: str | None = None
    legal_name: str | None = None
    phone: str | None = None
    email: str | None = None
    license_number: str | None = None
    license_expiry: datetime | None = None

    address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None

    latitude: float | None = None
    longitude: float | None = None

    active: bool | None = None


class FacilityResponse(BaseModel):
    id: int
    user_id: int

    facility_code: str
    legal_name: str

    phone: str
    email: str

    license_number: str
    license_expiry: datetime | None

    address: str
    city: str
    state: str
    postal_code: str

    latitude: float
    longitude: float

    active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }