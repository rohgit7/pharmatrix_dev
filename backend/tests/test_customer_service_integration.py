import uuid

import pytest
from fastapi import HTTPException
from app.models.hospital_profile import HospitalProfile
from app.models.clinic_profile import ClinicProfile
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.distributor_profile import DistributorProfile
from app.models.enums import CustomerType
from app.models.pharmacy_profile import PharmacyProfile
from app.models.user import User, UserRole
from app.schemas.customer import CustomerOnboardRequest
from app.services.customer_service import create_customer


def make_user(suffix: str) -> User:
    return User(
        auth_user_id=uuid.uuid4(),
        name=f"Customer Test {suffix}",
        email=f"customer-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )


def make_pharmacy_request() -> CustomerOnboardRequest:
    return CustomerOnboardRequest(
        customer_type=CustomerType.PHARMACY,
        legal_name="Integration Pharmacy Pvt Ltd",
        display_name="Integration Pharmacy",
        phone="9876543210",
        email="integration-pharmacy@test.local",
        gst_number="29ABCDE1234F1Z5",
        profile={
            "pharmacy_license_number": "KA-PH-TEST-001",
            "pharmacist_name": "Integration Pharmacist",
        },
        location={
            "location_code": "MAIN-001",
            "name": "Main Branch",
            "address_line_1": "123 Test Road",
            "address_line_2": "Near Test Hospital",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "contact_name": "Integration Pharmacist",
            "contact_phone": "9876543210",
            "service_time_seconds": 300,
        },
    )


def make_distributor_request() -> CustomerOnboardRequest:
    return CustomerOnboardRequest(
        customer_type=CustomerType.DISTRIBUTOR,
        legal_name="Integration Distributor Pvt Ltd",
        display_name="Integration Distributor",
        phone="9988776655",
        email="integration-distributor@test.local",
        gst_number="29ABCDE5678F1Z5",
        profile={
            "distribution_license_number": "DIST-TEST-001",
            "warehouse_count": 3,
            "coverage_area": "Bengaluru Urban",
        },
        location={
            "location_code": "WH-001",
            "name": "Main Warehouse",
            "address_line_1": "456 Distribution Road",
            "address_line_2": None,
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560002",
            "latitude": 12.9800,
            "longitude": 77.6000,
            "contact_name": "Warehouse Manager",
            "contact_phone": "9988776655",
            "service_time_seconds": 600,
        },
    )



def make_hospital_request() -> CustomerOnboardRequest:
    return CustomerOnboardRequest(
        customer_type=CustomerType.HOSPITAL,
        legal_name="Integration Hospital Pvt Ltd",
        display_name="Integration Hospital",
        phone="9876501234",
        email="integration-hospital@test.local",
        gst_number="29HOSP1234F1Z5",
        profile={
            "registration_number": "HOSP-REG-TEST-001",
            "hospital_type": "Multi-Speciality",
            "department_count": 12,
        },
        location={
            "location_code": "HOSP-001",
            "name": "Main Hospital",
            "address_line_1": "789 Hospital Road",
            "address_line_2": None,
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560003",
            "latitude": 12.9850,
            "longitude": 77.6050,
            "contact_name": "Hospital Administrator",
            "contact_phone": "9876501234",
            "service_time_seconds": 900,
        },
    )

def make_clinic_request() -> CustomerOnboardRequest:
    return CustomerOnboardRequest(
        customer_type=CustomerType.CLINIC,
        legal_name="Integration Clinic Pvt Ltd",
        display_name="Integration Clinic",
        phone="9876512345",
        email="integration-clinic@test.local",
        gst_number="29CLIN1234F1Z5",
        profile={
            "registration_number": "CLIN-REG-TEST-001",
            "clinic_type": "Speciality Clinic",
            "doctor_name": "Dr. Integration",
            "speciality": "General Medicine",
        },
        location={
            "location_code": "CLINIC-001",
            "name": "Main Clinic",
            "address_line_1": "321 Clinic Road",
            "address_line_2": None,
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560004",
            "latitude": 12.9900,
            "longitude": 77.6100,
            "contact_name": "Dr. Integration",
            "contact_phone": "9876512345",
            "service_time_seconds": 600,
        },
    )

def cleanup_user(db, user_id: int):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == user_id)
        .first()
    )

    if customer:
        db.delete(customer)
        db.flush()

    user = db.get(User, user_id)

    if user:
        db.delete(user)

    db.commit()


def test_create_customer_persists_pharmacy_profile_and_location(db):
    suffix = uuid.uuid4().hex

    user = make_user(suffix)

    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        request = make_pharmacy_request()

        customer = create_customer(
            db=db,
            user=user,
            data=request,
        )

        assert customer.id is not None
        assert customer.user_id == user.id
        assert customer.customer_type == CustomerType.PHARMACY
        assert customer.legal_name == (
            "Integration Pharmacy Pvt Ltd"
        )
        assert customer.display_name == "Integration Pharmacy"
        assert customer.phone == "9876543210"
        assert customer.email == (
            "integration-pharmacy@test.local"
        )
        assert customer.gst_number == (
            "29ABCDE1234F1Z5"
        )
        assert customer.is_active is True

        saved_customer = db.get(
            Customer,
            customer.id,
        )

        assert saved_customer is not None

        pharmacy_profile = (
            db.query(PharmacyProfile)
            .filter(
                PharmacyProfile.customer_id == customer.id
            )
            .first()
        )

        assert pharmacy_profile is not None
        assert pharmacy_profile.pharmacy_license_number == (
            "KA-PH-TEST-001"
        )
        assert pharmacy_profile.pharmacist_name == (
            "Integration Pharmacist"
        )
        assert pharmacy_profile.license_verified is False

        location = (
            db.query(CustomerLocation)
            .filter(
                CustomerLocation.customer_id == customer.id
            )
            .first()
        )

        assert location is not None
        assert location.location_code == "MAIN-001"
        assert location.name == "Main Branch"
        assert location.city == "Bengaluru"
        assert location.state == "Karnataka"
        assert location.postal_code == "560001"
        assert location.latitude == 12.9716
        assert location.longitude == 77.5946
        assert location.service_time_seconds == 300
        assert location.pickup_enabled is True
        assert location.is_active is True

    finally:
        cleanup_user(db, user.id)


def test_create_customer_persists_distributor_profile(db):
    suffix = uuid.uuid4().hex

    user = make_user(suffix)

    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        request = make_distributor_request()

        customer = create_customer(
            db=db,
            user=user,
            data=request,
        )

        assert customer.customer_type == (
            CustomerType.DISTRIBUTOR
        )

        distributor_profile = (
            db.query(DistributorProfile)
            .filter(
                DistributorProfile.customer_id == customer.id
            )
            .first()
        )

        assert distributor_profile is not None
        assert (
            distributor_profile.distribution_license_number
            == "DIST-TEST-001"
        )
        assert distributor_profile.warehouse_count == 3
        assert distributor_profile.coverage_area == (
            "Bengaluru Urban"
        )
        assert distributor_profile.license_verified is False

        location = (
            db.query(CustomerLocation)
            .filter(
                CustomerLocation.customer_id == customer.id
            )
            .first()
        )

        assert location is not None
        assert location.location_code == "WH-001"
        assert location.service_time_seconds == 600

    finally:
        cleanup_user(db, user.id)


def test_create_customer_rejects_duplicate_customer_profile(db):
    user = make_user("duplicate")
    db.add(user)
    db.commit()
    db.refresh(user)

    customer = None

    try:
        data = make_pharmacy_request()

        customer = create_customer(db, user, data)

        with pytest.raises(HTTPException) as exc:
            create_customer(db, user, data)

        assert exc.value.status_code == 409
        assert exc.value.detail == "Customer profile already exists"

    finally:
        if customer is not None:
            db.delete(customer)

        db.delete(user)
        db.commit()

def test_create_distributor_customer(db):
    user = make_user("distributor")
    db.add(user)
    db.commit()
    db.refresh(user)

    customer = None

    try:
        data = make_distributor_request()

        customer = create_customer(db, user, data)

        assert customer.id is not None
        assert customer.user_id == user.id
        assert customer.customer_type == CustomerType.DISTRIBUTOR
        assert customer.legal_name == "Integration Distributor Pvt Ltd"

        profile = (
            db.query(DistributorProfile)
            .filter(DistributorProfile.customer_id == customer.id)
            .first()
        )

        assert profile is not None
        assert profile.distribution_license_number == "DIST-TEST-001"
        assert profile.warehouse_count == 3
        assert profile.coverage_area == "Bengaluru Urban"

        location = (
            db.query(CustomerLocation)
            .filter(CustomerLocation.customer_id == customer.id)
            .first()
        )

        assert location is not None
        assert location.location_code == "WH-001"

    finally:
        if customer is not None:
            db.delete(customer)

        db.delete(user)
        db.commit()

def test_create_hospital_customer(db):
    user = make_user("hospital")
    db.add(user)
    db.commit()
    db.refresh(user)

    customer = None

    try:
        data = make_hospital_request()

        customer = create_customer(db, user, data)

        assert customer.id is not None
        assert customer.user_id == user.id
        assert customer.customer_type == CustomerType.HOSPITAL
        assert customer.legal_name == "Integration Hospital Pvt Ltd"

        profile = (
            db.query(HospitalProfile)
            .filter(HospitalProfile.customer_id == customer.id)
            .first()
        )

        assert profile is not None
        assert profile.registration_number == "HOSP-REG-TEST-001"
        assert profile.hospital_type == "Multi-Speciality"
        assert profile.department_count == 12
        assert profile.registration_verified is False

        location = (
            db.query(CustomerLocation)
            .filter(CustomerLocation.customer_id == customer.id)
            .first()
        )

        assert location is not None
        assert location.location_code == "HOSP-001"

    finally:
        if customer is not None:
            db.delete(customer)

        db.delete(user)
        db.commit()

def test_create_clinic_customer(db):
    user = make_user("clinic")
    db.add(user)
    db.commit()
    db.refresh(user)

    customer = None

    try:
        data = make_clinic_request()

        customer = create_customer(db, user, data)

        assert customer.id is not None
        assert customer.user_id == user.id
        assert customer.customer_type == CustomerType.CLINIC
        assert customer.legal_name == "Integration Clinic Pvt Ltd"

        profile = (
            db.query(ClinicProfile)
            .filter(ClinicProfile.customer_id == customer.id)
            .first()
        )

        assert profile is not None
        assert profile.registration_number == "CLIN-REG-TEST-001"
        assert profile.clinic_type == "Speciality Clinic"
        assert profile.doctor_name == "Dr. Integration"
        assert profile.speciality == "General Medicine"
        assert profile.registration_verified is False

        location = (
            db.query(CustomerLocation)
            .filter(CustomerLocation.customer_id == customer.id)
            .first()
        )

        assert location is not None
        assert location.location_code == "CLINIC-001"

    finally:
        if customer is not None:
            db.delete(customer)

        db.delete(user)
        db.commit()