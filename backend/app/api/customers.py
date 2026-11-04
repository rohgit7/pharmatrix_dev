from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import CustomerType
from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.customer import (
    CustomerLocationResponse,
    CustomerOnboardRequest,
    CustomerResponse,
    LocationCreate,
)
from app.services.customer_service import create_customer, ensure_customer_pricing_assignment


router = APIRouter(
    prefix="/api/customers",
    tags=["Customers"],
)


class CustomerUpdateRequest(BaseModel):
    legal_name: str | None = Field(default=None, min_length=2, max_length=255)
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    email: EmailStr | None = None
    gst_number: str | None = Field(default=None, max_length=30)
    profile: dict[str, Any] | None = None


class CustomerLocationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    address_line_1: str | None = Field(default=None, min_length=3, max_length=255)
    address_line_2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=100)
    postal_code: str | None = Field(default=None, min_length=4, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    contact_name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_phone: str | None = Field(default=None, min_length=7, max_length=20)
    is_active: bool | None = None


def _serialize_customer_type_profile(customer: Any) -> dict[str, Any] | None:
    ctype = getattr(customer, "customer_type", None)
    if ctype == CustomerType.PHARMACY:
        prof = getattr(customer, "pharmacy_profile", None)
        if prof is not None:
            return {
                "pharmacy_license_number": getattr(prof, "pharmacy_license_number", None),
                "pharmacist_name": getattr(prof, "pharmacist_name", None),
                "license_verified": bool(getattr(prof, "license_verified", False)),
            }
    elif ctype == CustomerType.DISTRIBUTOR:
        prof = getattr(customer, "distributor_profile", None)
        if prof is not None:
            return {
                "distribution_license_number": getattr(prof, "distribution_license_number", None),
                "warehouse_count": getattr(prof, "warehouse_count", 1),
                "coverage_area": getattr(prof, "coverage_area", None),
                "license_verified": bool(getattr(prof, "license_verified", False)),
            }
    elif ctype == CustomerType.HOSPITAL:
        prof = getattr(customer, "hospital_profile", None)
        if prof is not None:
            return {
                "registration_number": getattr(prof, "registration_number", None),
                "hospital_type": getattr(prof, "hospital_type", None),
                "department_count": getattr(prof, "department_count", None),
                "registration_verified": bool(getattr(prof, "registration_verified", False)),
            }
    elif ctype == CustomerType.CLINIC:
        prof = getattr(customer, "clinic_profile", None)
        if prof is not None:
            return {
                "registration_number": getattr(prof, "registration_number", None),
                "clinic_type": getattr(prof, "clinic_type", None),
                "doctor_name": getattr(prof, "doctor_name", None),
                "speciality": getattr(prof, "speciality", None),
                "registration_verified": bool(getattr(prof, "registration_verified", False)),
            }
    return None


def _serialize_location(loc: Any) -> dict[str, Any]:
    return {
        "id": getattr(loc, "id", None),
        "public_id": str(getattr(loc, "public_id", "")) if getattr(loc, "public_id", None) else None,
        "location_code": getattr(loc, "location_code", None),
        "name": getattr(loc, "name", None),
        "address_line_1": getattr(loc, "address_line_1", None),
        "address_line_2": getattr(loc, "address_line_2", None),
        "city": getattr(loc, "city", None),
        "state": getattr(loc, "state", None),
        "postal_code": getattr(loc, "postal_code", None),
        "latitude": getattr(loc, "latitude", None),
        "longitude": getattr(loc, "longitude", None),
        "contact_name": getattr(loc, "contact_name", None),
        "contact_phone": getattr(loc, "contact_phone", None),
        "service_time_seconds": getattr(loc, "service_time_seconds", 300),
        "is_active": bool(getattr(loc, "is_active", True)),
    }


@router.post(
    "/onboard",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def onboard_customer(
    data: CustomerOnboardRequest,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    return create_customer(
        db=db,
        user=current_user,
        data=data,
    )


@router.get("/me")
def get_my_customer(
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )

    if not customer:
        return {
            "onboarded": False
        }

    if hasattr(customer, "id") and isinstance(customer.id, int):
        try:
            ensure_customer_pricing_assignment(db, customer.id)
            db.commit()
        except Exception:
            pass

    raw_locations = getattr(customer, "locations", None) or []
    locations_list = [_serialize_location(loc) for loc in raw_locations]

    result: dict[str, Any] = {
        "onboarded": True,
        "public_id": str(customer.public_id),
        "customer_code": customer.customer_code,
        "customer_type": (
            customer.customer_type.value
            if hasattr(customer.customer_type, "value")
            else str(customer.customer_type)
        ),
        "legal_name": customer.legal_name,
        "display_name": customer.display_name,
    }

    if hasattr(customer, "id"):
        result["id"] = customer.id
    if hasattr(customer, "phone"):
        result["phone"] = customer.phone
    if hasattr(customer, "email"):
        result["email"] = customer.email
    if hasattr(customer, "gst_number"):
        result["gst_number"] = customer.gst_number
    if hasattr(customer, "is_active"):
        result["is_active"] = customer.is_active
    if raw_locations or hasattr(customer, "locations"):
        result["locations"] = locations_list

    type_profile = _serialize_customer_type_profile(customer)
    if type_profile is not None:
        result["profile"] = type_profile

    return result


@router.patch("/me")
def update_my_customer(
    data: CustomerUpdateRequest,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found",
        )

    if data.legal_name is not None:
        customer.legal_name = data.legal_name.strip()
    if data.display_name is not None:
        customer.display_name = data.display_name.strip()
    if data.phone is not None:
        customer.phone = data.phone.strip()
    if data.email is not None:
        customer.email = data.email.strip().lower()
    if data.gst_number is not None:
        customer.gst_number = data.gst_number.strip() or None

    if data.profile and isinstance(data.profile, dict):
        ctype = customer.customer_type
        if ctype == CustomerType.PHARMACY and customer.pharmacy_profile:
            if "pharmacy_license_number" in data.profile:
                customer.pharmacy_profile.pharmacy_license_number = data.profile["pharmacy_license_number"]
            if "pharmacist_name" in data.profile:
                customer.pharmacy_profile.pharmacist_name = data.profile["pharmacist_name"]
        elif ctype == CustomerType.DISTRIBUTOR and customer.distributor_profile:
            if "distribution_license_number" in data.profile:
                customer.distributor_profile.distribution_license_number = data.profile["distribution_license_number"]
            if "warehouse_count" in data.profile and data.profile["warehouse_count"] is not None:
                customer.distributor_profile.warehouse_count = int(data.profile["warehouse_count"])
            if "coverage_area" in data.profile:
                customer.distributor_profile.coverage_area = data.profile["coverage_area"]
        elif ctype == CustomerType.HOSPITAL and customer.hospital_profile:
            if "registration_number" in data.profile:
                customer.hospital_profile.registration_number = data.profile["registration_number"]
            if "hospital_type" in data.profile:
                customer.hospital_profile.hospital_type = data.profile["hospital_type"]
            if "department_count" in data.profile and data.profile["department_count"] is not None:
                customer.hospital_profile.department_count = int(data.profile["department_count"])
        elif ctype == CustomerType.CLINIC and customer.clinic_profile:
            if "registration_number" in data.profile:
                customer.clinic_profile.registration_number = data.profile["registration_number"]
            if "clinic_type" in data.profile:
                customer.clinic_profile.clinic_type = data.profile["clinic_type"]
            if "doctor_name" in data.profile:
                customer.clinic_profile.doctor_name = data.profile["doctor_name"]
            if "speciality" in data.profile:
                customer.clinic_profile.speciality = data.profile["speciality"]

    db.commit()
    db.refresh(customer)

    return get_my_customer(current_user=current_user, db=db)


@router.get(
    "/locations",
    response_model=list[CustomerLocationResponse],
)
def get_my_locations(
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found",
        )

    return (
        db.query(CustomerLocation)
        .filter(
            CustomerLocation.customer_id == customer.id,
            CustomerLocation.is_active.is_(True),
        )
        .order_by(CustomerLocation.id.asc())
        .all()
    )


@router.post(
    "/locations",
    response_model=CustomerLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_my_location(
    data: LocationCreate,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found",
        )

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=data.location_code,
        name=data.name,
        address_line_1=data.address_line_1,
        address_line_2=data.address_line_2,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        latitude=data.latitude,
        longitude=data.longitude,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        service_time_seconds=data.service_time_seconds,
        is_active=True,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.patch(
    "/locations/{location_id}",
    response_model=CustomerLocationResponse,
)
def update_my_location(
    location_id: int,
    data: CustomerLocationUpdateRequest,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found",
        )

    location = (
        db.query(CustomerLocation)
        .filter(
            CustomerLocation.id == location_id,
            CustomerLocation.customer_id == customer.id,
        )
        .first()
    )
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    for field in [
        "name",
        "address_line_1",
        "address_line_2",
        "city",
        "state",
        "postal_code",
        "latitude",
        "longitude",
        "contact_name",
        "contact_phone",
        "is_active",
    ]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(location, field, val)

    db.commit()
    db.refresh(location)
    return location
