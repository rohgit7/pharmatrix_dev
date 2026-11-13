from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
import re

from app.models.enums import CustomerType


class LocationCreate(BaseModel):
    location_code: str = Field(default="LOC-001", min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)

    address_line_1: str = Field(min_length=1, max_length=255)
    address_line_2: Optional[str] = Field(default=None, max_length=255)

    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=4, max_length=20)

    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    service_time_seconds: int = 300

    @field_validator("name", "address_line_1", "city", "state", "postal_code")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def validate_coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together when specifying GPS coordinates")
        return self


class PharmacyProfileCreate(BaseModel):
    pharmacy_license_number: Optional[str] = None
    pharmacist_name: Optional[str] = None


class DistributorProfileCreate(BaseModel):
    distribution_license_number: Optional[str] = None
    warehouse_count: int = 1
    coverage_area: Optional[str] = None


class HospitalProfileCreate(BaseModel):
    registration_number: Optional[str] = None
    hospital_type: Optional[str] = None
    department_count: Optional[int] = None


class ClinicProfileCreate(BaseModel):
    registration_number: Optional[str] = None
    clinic_type: Optional[str] = None
    doctor_name: Optional[str] = None
    speciality: Optional[str] = None


class CustomerOnboardRequest(BaseModel):
    customer_type: CustomerType

    legal_name: str = Field(min_length=2, max_length=255)
    display_name: str = Field(min_length=2, max_length=255)

    phone: str = Field(min_length=7, max_length=20)
    email: Optional[str] = None
    gst_number: Optional[str] = None

    profile: Optional[dict] = None

    location: LocationCreate

    @field_validator("legal_name", "display_name")
    @classmethod
    def validate_names(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Name must be at least 2 characters")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip()
        digits = re.sub(r"\D", "", cleaned)
        if len(digits) < 7 or len(digits) > 15:
            raise ValueError("Enter a valid phone number (7 to 15 digits)")
        return cleaned

from datetime import datetime
from uuid import UUID

class CustomerResponse(BaseModel):
    id: int
    user_id: int

    public_id: UUID | str
    customer_code: str

    customer_type: CustomerType

    legal_name: str
    display_name: str

    phone: str
    email: str | None
    gst_number: str | None

    is_active: bool

    model_config = {
        "from_attributes": True
    }


class CustomerLocationResponse(BaseModel):
    id: int
    customer_id: int
    location_code: str
    name: str
    address_line_1: str
    address_line_2: str | None = None
    city: str
    state: str
    postal_code: str
    latitude: float | None = None
    longitude: float | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    service_time_seconds: int = 300
    pickup_enabled: bool = True
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class CustomerLocationAdminCreate(BaseModel):
    location_code: str | None = None
    name: str = Field(min_length=1, max_length=150)
    address_line_1: str = Field(min_length=1, max_length=250)
    address_line_2: str | None = None
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_name: str | None = None
    contact_phone: str | None = None
    service_time_seconds: int = 300
    pickup_enabled: bool = True
    is_active: bool = True


class CustomerLocationAdminUpdate(BaseModel):
    name: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_name: str | None = None
    contact_phone: str | None = None
    service_time_seconds: int | None = None
    pickup_enabled: bool | None = None
    is_active: bool | None = None


class CustomerAdminCreate(BaseModel):
    customer_type: CustomerType
    legal_name: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=20)
    email: str | None = None
    gst_number: str | None = None
    user_id: int | None = None
    is_active: bool = True
    location: CustomerLocationAdminCreate | None = None
    profile: dict | None = None


class CustomerAdminUpdate(BaseModel):
    customer_type: CustomerType | None = None
    legal_name: str | None = None
    display_name: str | None = None
    phone: str | None = None
    email: str | None = None
    gst_number: str | None = None
    is_active: bool | None = None


class PharmacyProfileResponse(BaseModel):
    id: int
    customer_id: int
    pharmacy_license_number: str | None = None
    pharmacist_name: str | None = None
    license_verified: bool = False

    model_config = {"from_attributes": True}


class DistributorProfileResponse(BaseModel):
    id: int
    customer_id: int
    distribution_license_number: str | None = None
    warehouse_count: int = 1
    coverage_area: str | None = None
    license_verified: bool = False

    model_config = {"from_attributes": True}


class HospitalProfileResponse(BaseModel):
    id: int
    customer_id: int
    registration_number: str | None = None
    hospital_type: str | None = None
    department_count: int | None = None
    registration_verified: bool = False

    model_config = {"from_attributes": True}


class ClinicProfileResponse(BaseModel):
    id: int
    customer_id: int
    registration_number: str | None = None
    clinic_type: str | None = None
    doctor_name: str | None = None
    speciality: str | None = None
    registration_verified: bool = False

    model_config = {"from_attributes": True}


class CustomerDetailResponse(CustomerResponse):
    locations: list[CustomerLocationResponse] = []
    pharmacy_profile: PharmacyProfileResponse | None = None
    distributor_profile: DistributorProfileResponse | None = None
    hospital_profile: HospitalProfileResponse | None = None
    clinic_profile: ClinicProfileResponse | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


