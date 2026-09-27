from pydantic import BaseModel, Field
from typing import Optional

from app.models.enums import CustomerType


class LocationCreate(BaseModel):
    location_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)

    address_line_1: str
    address_line_2: Optional[str] = None

    city: str
    state: str
    postal_code: str

    latitude: float
    longitude: float

    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    service_time_seconds: int = 300


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

    legal_name: str
    display_name: str

    phone: str
    email: Optional[str] = None
    gst_number: Optional[str] = None

    profile: dict

    location: LocationCreate

class CustomerResponse(BaseModel):
    id: int
    user_id: int
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
