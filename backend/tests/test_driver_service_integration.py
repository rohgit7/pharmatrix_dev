import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.driver import Driver
from app.models.driver_vehicle_assignment import (
    DriverVehicleAssignment,
)
from app.models.enums import (
    DriverStatus,
    UserRole,
    VehicleStatus,
    VehicleType,
)
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.driver import DriverCreate, DriverUpdate
from app.services.driver_service import (
    create_driver,
    get_driver,
    list_drivers,
    update_driver,
)


# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

def make_driver_setup(db, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Driver Test {suffix}",
        email=f"driver-{suffix}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def cleanup_driver(
    db,
    *,
    driver,
    user,
    assignment=None,
    vehicle=None,
):
    if assignment is not None:
        db.delete(assignment)

    if driver is not None:
        db.delete(driver)

    if vehicle is not None:
        db.delete(vehicle)

    if user is not None:
        db.delete(user)

    db.commit()


# ---------------------------------------------------------
# Create driver
# ---------------------------------------------------------

def test_create_driver_persists_driver(db):
    user = make_driver_setup(db)

    driver = None

    try:
        data = DriverCreate(
            user_id=user.id,
            employee_id=f"EMP-{uuid.uuid4().hex[:8]}",
            phone="9876543210",
            license_number=f"LIC-{uuid.uuid4().hex[:8]}",
            license_expiry=date(2030, 12, 31),
        )

        driver = create_driver(
            db=db,
            data=data,
        )

        assert driver.id is not None
        assert driver.user_id == user.id
        assert driver.employee_id == data.employee_id
        assert driver.phone == data.phone
        assert driver.license_number == (
            data.license_number
        )
        assert driver.license_expiry == (
            data.license_expiry
        )
        assert driver.status == DriverStatus.ACTIVE
        assert driver.is_available is True

        saved_driver = db.get(
            Driver,
            driver.id,
        )

        assert saved_driver is not None
        assert saved_driver.employee_id == (
            data.employee_id
        )

    finally:
        cleanup_driver(
            db,
            driver=driver,
            user=user,
        )


def test_create_driver_rejects_missing_user(db):
    data = DriverCreate(
        user_id=999999999,
        employee_id="EMP-MISSING",
        phone="9876543210",
        license_number="LIC-MISSING",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_driver(
            db=db,
            data=data,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "User not found"


def test_create_driver_rejects_non_driver_user(db):
    user = User(
        auth_user_id=uuid.uuid4(),
        name="Customer User",
        email=f"customer-{uuid.uuid4().hex}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        data = DriverCreate(
            user_id=user.id,
            employee_id="EMP-CUSTOMER",
            phone="9876543210",
            license_number="LIC-CUSTOMER",
        )

        with pytest.raises(HTTPException) as exc_info:
            create_driver(
                db=db,
                data=data,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "User must have DRIVER role"
        )

    finally:
        db.delete(user)
        db.commit()


def test_create_driver_rejects_duplicate_employee_id(
    db,
):
    user_a = make_driver_setup(db)
    user_b = make_driver_setup(db)

    driver_a = None
    driver_b = None

    employee_id = (
        f"EMP-{uuid.uuid4().hex[:8]}"
    )

    try:
        driver_a = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_a.id,
                employee_id=employee_id,
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        with pytest.raises(HTTPException) as exc_info:
            driver_b = create_driver(
                db=db,
                data=DriverCreate(
                    user_id=user_b.id,
                    employee_id=employee_id,
                    phone="9999999999",
                    license_number=(
                        f"LIC-{uuid.uuid4().hex[:8]}"
                    ),
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Employee ID already exists"
        )

    finally:
        cleanup_driver(
            db,
            driver=driver_a,
            user=user_a,
        )

        cleanup_driver(
            db,
            driver=driver_b,
            user=user_b,
        )


def test_create_driver_rejects_duplicate_license(
    db,
):
    user_a = make_driver_setup(db)
    user_b = make_driver_setup(db)

    driver_a = None
    driver_b = None

    license_number = (
        f"LIC-{uuid.uuid4().hex[:8]}"
    )

    try:
        driver_a = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_a.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=license_number,
            ),
        )

        with pytest.raises(HTTPException) as exc_info:
            driver_b = create_driver(
                db=db,
                data=DriverCreate(
                    user_id=user_b.id,
                    employee_id=(
                        f"EMP-{uuid.uuid4().hex[:8]}"
                    ),
                    phone="9999999999",
                    license_number=license_number,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "License number already exists"
        )

    finally:
        cleanup_driver(
            db,
            driver=driver_a,
            user=user_a,
        )

        cleanup_driver(
            db,
            driver=driver_b,
            user=user_b,
        )


# ---------------------------------------------------------
# Get driver
# ---------------------------------------------------------

def test_get_driver_returns_persisted_driver(db):
    user = make_driver_setup(db)
    driver = None

    try:
        driver = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        result = get_driver(
            db=db,
            driver_id=driver.id,
        )

        assert result.id == driver.id
        assert result.user_id == user.id

    finally:
        cleanup_driver(
            db,
            driver=driver,
            user=user,
        )


def test_get_driver_rejects_missing_driver(db):
    with pytest.raises(HTTPException) as exc_info:
        get_driver(
            db=db,
            driver_id=999999999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == (
        "Driver not found"
    )


# ---------------------------------------------------------
# List drivers
# ---------------------------------------------------------

def test_list_drivers_returns_recent_drivers(
    db,
):
    user_a = make_driver_setup(db)
    user_b = make_driver_setup(db)

    driver_a = None
    driver_b = None

    try:
        driver_a = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_a.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        driver_b = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_b.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9999999999",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        drivers = list_drivers(
            db=db,
            skip=0,
            limit=2,
        )

        ids = [driver.id for driver in drivers]

        assert driver_a.id in ids
        assert driver_b.id in ids

    finally:
        cleanup_driver(
            db,
            driver=driver_a,
            user=user_a,
        )

        cleanup_driver(
            db,
            driver=driver_b,
            user=user_b,
        )


# ---------------------------------------------------------
# Update driver
# ---------------------------------------------------------

def test_update_driver_persists_changes(db):
    user = make_driver_setup(db)
    driver = None

    try:
        driver = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        updated = update_driver(
            db=db,
            driver_id=driver.id,
            data=DriverUpdate(
                phone="9999999999",
                license_expiry=date(
                    2032,
                    1,
                    1,
                ),
                is_available=False,
            ),
        )

        assert updated.phone == "9999999999"
        assert updated.license_expiry == date(
            2032,
            1,
            1,
        )
        assert updated.is_available is False

        db.refresh(driver)

        assert driver.phone == "9999999999"
        assert driver.is_available is False

    finally:
        cleanup_driver(
            db,
            driver=driver,
            user=user,
        )


def test_update_driver_rejects_duplicate_employee_id(
    db,
):
    user_a = make_driver_setup(db)
    user_b = make_driver_setup(db)

    driver_a = None
    driver_b = None

    try:
        driver_a = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_a.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        driver_b = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_b.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9999999999",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_driver(
                db=db,
                driver_id=driver_b.id,
                data=DriverUpdate(
                    employee_id=driver_a.employee_id,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Employee ID already exists"
        )

    finally:
        cleanup_driver(
            db,
            driver=driver_a,
            user=user_a,
        )

        cleanup_driver(
            db,
            driver=driver_b,
            user=user_b,
        )


def test_update_driver_rejects_duplicate_license(
    db,
):
    user_a = make_driver_setup(db)
    user_b = make_driver_setup(db)

    driver_a = None
    driver_b = None

    try:
        driver_a = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_a.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        driver_b = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user_b.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9999999999",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_driver(
                db=db,
                driver_id=driver_b.id,
                data=DriverUpdate(
                    license_number=driver_a.license_number,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "License number already exists"
        )

    finally:
        cleanup_driver(
            db,
            driver=driver_a,
            user=user_a,
        )

        cleanup_driver(
            db,
            driver=driver_b,
            user=user_b,
        )


# ---------------------------------------------------------
# Active vehicle assignment guard
# ---------------------------------------------------------

def test_update_driver_rejects_suspension_with_active_assignment(
    db,
):
    user = make_driver_setup(db)

    driver = None
    vehicle = None
    assignment = None

    try:
        driver = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        vehicle = Vehicle(
            registration_number=(
                f"KA-{uuid.uuid4().hex[:10]}"
            ),
            vehicle_type=VehicleType.VAN,
            capacity_kg=100,
            status=VehicleStatus.ASSIGNED,
        )

        db.add(vehicle)
        db.flush()

        assignment = DriverVehicleAssignment(
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            assigned_at=datetime.now(timezone.utc),
            notes="Driver service integration test",
        )

        db.add(assignment)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            update_driver(
                db=db,
                driver_id=driver.id,
                data=DriverUpdate(
                    status=DriverStatus.SUSPENDED,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Unassign the driver's vehicle before "
            "deactivating or suspending the driver"
        )

        db.refresh(driver)

        assert driver.status == DriverStatus.ACTIVE

    finally:
        cleanup_driver(
            db,
            driver=driver,
            user=user,
            assignment=assignment,
            vehicle=vehicle,
        )


def test_update_driver_allows_suspension_after_vehicle_unassigned(
    db,
):
    user = make_driver_setup(db)

    driver = None
    vehicle = None
    assignment = None

    try:
        driver = create_driver(
            db=db,
            data=DriverCreate(
                user_id=user.id,
                employee_id=(
                    f"EMP-{uuid.uuid4().hex[:8]}"
                ),
                phone="9876543210",
                license_number=(
                    f"LIC-{uuid.uuid4().hex[:8]}"
                ),
            ),
        )

        vehicle = Vehicle(
            registration_number=(
                f"KA-{uuid.uuid4().hex[:10]}"
            ),
            vehicle_type=VehicleType.VAN,
            capacity_kg=100,
            status=VehicleStatus.ASSIGNED,
        )

        db.add(vehicle)
        db.flush()

        assigned_at = datetime.now(timezone.utc)

        assignment = DriverVehicleAssignment(
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            assigned_at=assigned_at,
        )

        db.add(assignment)
        db.commit()

        assignment.unassigned_at = (
            assigned_at + timedelta(minutes=5)
        )

        vehicle.status = VehicleStatus.AVAILABLE

        db.commit()

        updated = update_driver(
            db=db,
            driver_id=driver.id,
            data=DriverUpdate(
                status=DriverStatus.SUSPENDED,
            ),
        )

        assert updated.status == (
            DriverStatus.SUSPENDED
        )

        db.refresh(driver)

        assert driver.status == (
            DriverStatus.SUSPENDED
        )

    finally:
        cleanup_driver(
            db,
            driver=driver,
            user=user,
            assignment=assignment,
            vehicle=vehicle,
        )