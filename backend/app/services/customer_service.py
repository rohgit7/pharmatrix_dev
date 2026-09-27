from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import CustomerType
from app.models.pharmacy_profile import PharmacyProfile
from app.models.distributor_profile import DistributorProfile
from app.models.hospital_profile import HospitalProfile
from app.models.clinic_profile import ClinicProfile
from app.models.user import User
from app.schemas.customer import CustomerOnboardRequest


def create_customer(
    db: Session,
    user: User,
    data: CustomerOnboardRequest,
) -> Customer:

    # A user can only have one customer profile.
    existing = (
        db.query(Customer)
        .filter(Customer.user_id == user.id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Customer profile already exists",
        )

    customer = Customer(
        user_id=user.id,
        customer_type=data.customer_type,
        legal_name=data.legal_name,
        display_name=data.display_name,
        phone=data.phone,
        email=data.email,
        gst_number=data.gst_number,
    )

    db.add(customer)
    db.flush()

    profile = data.profile

    if data.customer_type == CustomerType.PHARMACY:

        db.add(
            PharmacyProfile(
                customer_id=customer.id,
                pharmacy_license_number=profile.get(
                    "pharmacy_license_number"
                ),
                pharmacist_name=profile.get(
                    "pharmacist_name"
                ),
            )
        )

    elif data.customer_type == CustomerType.DISTRIBUTOR:

        db.add(
            DistributorProfile(
                customer_id=customer.id,
                distribution_license_number=profile.get(
                    "distribution_license_number"
                ),
                warehouse_count=profile.get(
                    "warehouse_count",
                    1,
                ),
                coverage_area=profile.get(
                    "coverage_area"
                ),
            )
        )

    elif data.customer_type == CustomerType.HOSPITAL:

        db.add(
            HospitalProfile(
                customer_id=customer.id,
                registration_number=profile.get(
                    "registration_number"
                ),
                hospital_type=profile.get(
                    "hospital_type"
                ),
                department_count=profile.get(
                    "department_count"
                ),
            )
        )

    elif data.customer_type == CustomerType.CLINIC:

        db.add(
            ClinicProfile(
                customer_id=customer.id,
                registration_number=profile.get(
                    "registration_number"
                ),
                clinic_type=profile.get(
                    "clinic_type"
                ),
                doctor_name=profile.get(
                    "doctor_name"
                ),
                speciality=profile.get(
                    "speciality"
                ),
            )
        )

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=data.location.location_code,
        name=data.location.name,
        address_line_1=data.location.address_line_1,
        address_line_2=data.location.address_line_2,
        city=data.location.city,
        state=data.location.state,
        postal_code=data.location.postal_code,
        latitude=data.location.latitude,
        longitude=data.location.longitude,
        contact_name=data.location.contact_name,
        contact_phone=data.location.contact_phone,
        service_time_seconds=data.location.service_time_seconds,
    )

    db.add(location)

    db.commit()
    db.refresh(customer)

    return customer