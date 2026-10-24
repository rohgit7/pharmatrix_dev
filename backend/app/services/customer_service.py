import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import CustomerType
from app.models.pharmacy_profile import PharmacyProfile
from app.models.distributor_profile import DistributorProfile
from app.models.hospital_profile import HospitalProfile
from app.models.clinic_profile import ClinicProfile
from app.models.user import User, UserRole
from app.schemas.customer import CustomerOnboardRequest

CUSTOMER_CODE_PREFIXES = {
    CustomerType.PHARMACY: "PMP",
    CustomerType.DISTRIBUTOR: "PMD",
    CustomerType.HOSPITAL: "PMH",
    CustomerType.CLINIC: "PMC",
}


def generate_customer_code(db: Session, customer_type: CustomerType) -> str:
    prefix = CUSTOMER_CODE_PREFIXES.get(customer_type, "CUS")
    try:
        result = db.execute(
            text("SELECT nextval('customer_code_seq')")
        )
        sequence_number = result.scalar_one()
        return f"{prefix}{sequence_number:06d}"
    except Exception:
        return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


def create_customer_profile(
    db: Session,
    customer: Customer,
    profile_data: dict | None = None,
) -> PharmacyProfile | DistributorProfile | HospitalProfile | ClinicProfile:
    """
    Creates and attaches the corresponding customer-type profile for a given customer.
    Respects existing unique constraints, data types, defaults, and prevents duplicate profiles.
    """
    existing_profiles = [
        db.query(PharmacyProfile).filter(PharmacyProfile.customer_id == customer.id).first(),
        db.query(DistributorProfile).filter(DistributorProfile.customer_id == customer.id).first(),
        db.query(HospitalProfile).filter(HospitalProfile.customer_id == customer.id).first(),
        db.query(ClinicProfile).filter(ClinicProfile.customer_id == customer.id).first(),
    ]
    if any(p is not None for p in existing_profiles):
        raise HTTPException(
            status_code=409,
            detail="A customer profile already exists for this customer",
        )

    profile_dict = profile_data or {}
    if hasattr(profile_dict, "model_dump"):
        profile_dict = profile_dict.model_dump()
    elif not isinstance(profile_dict, dict):
        raise HTTPException(
            status_code=422,
            detail="Profile data must be a dictionary or object",
        )

    profile_obj = None

    if customer.customer_type == CustomerType.PHARMACY:
        profile_obj = PharmacyProfile(
            customer_id=customer.id,
            pharmacy_license_number=profile_dict.get("pharmacy_license_number"),
            pharmacist_name=profile_dict.get("pharmacist_name"),
            license_verified=bool(profile_dict.get("license_verified", False)),
        )

    elif customer.customer_type == CustomerType.DISTRIBUTOR:
        wh_raw = profile_dict.get("warehouse_count")
        warehouse_count = 1
        if wh_raw is not None and wh_raw != "":
            try:
                warehouse_count = int(wh_raw)
                if warehouse_count < 1:
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=422,
                    detail="warehouse_count must be a positive integer",
                )

        profile_obj = DistributorProfile(
            customer_id=customer.id,
            distribution_license_number=profile_dict.get("distribution_license_number"),
            warehouse_count=warehouse_count,
            coverage_area=profile_dict.get("coverage_area"),
            license_verified=bool(profile_dict.get("license_verified", False)),
        )

    elif customer.customer_type == CustomerType.HOSPITAL:
        dept_raw = profile_dict.get("department_count")
        dept_count = None
        if dept_raw is not None and dept_raw != "":
            try:
                dept_count = int(dept_raw)
                if dept_count < 0:
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=422,
                    detail="department_count must be a valid non-negative integer",
                )

        profile_obj = HospitalProfile(
            customer_id=customer.id,
            registration_number=profile_dict.get("registration_number"),
            hospital_type=profile_dict.get("hospital_type"),
            department_count=dept_count,
            registration_verified=bool(profile_dict.get("registration_verified", False)),
        )

    elif customer.customer_type == CustomerType.CLINIC:
        profile_obj = ClinicProfile(
            customer_id=customer.id,
            registration_number=profile_dict.get("registration_number"),
            clinic_type=profile_dict.get("clinic_type"),
            doctor_name=profile_dict.get("doctor_name"),
            speciality=profile_dict.get("speciality"),
            registration_verified=bool(profile_dict.get("registration_verified", False)),
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported customer type: {customer.customer_type}",
        )

    db.add(profile_obj)
    return profile_obj


def create_customer(
    db: Session,
    user: User,
    data: CustomerOnboardRequest,
) -> Customer:

    # Enforce customer role authorization if user has role attribute
    if hasattr(user, "role") and user.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=403,
            detail="Only customer accounts can be onboarded as customers",
        )

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

    try:
        customer = Customer(
            user_id=user.id,
            customer_type=data.customer_type,
            customer_code=generate_customer_code(db, data.customer_type),
            legal_name=data.legal_name,
            display_name=data.display_name,
            phone=data.phone,
            email=data.email,
            gst_number=data.gst_number,
        )

        db.add(customer)
        db.flush()

        # Automatically create type-specific profile
        create_customer_profile(db, customer, data.profile)

        if data.location:
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

    except Exception:
        db.rollback()
        raise