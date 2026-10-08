import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
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
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services.vehicle_service import (
    create_vehicle,
    get_vehicle,
    list_vehicles,
    update_vehicle,
)


# ---------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------

def make_user(db):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Vehicle Test User {uuid.uuid4().hex[:8]}",
        email=(
            f"vehicle-{uuid.uuid4().hex}@test.local"
        ),
        role=UserRole.DRIVER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_vehicle(
    db,
    *,
    registration_number=None,
    capacity=Decimal("100.00"),
):
    vehicle = Vehicle(
        registration_number=(
            registration_number
            or f"KA-{uuid.uuid4().hex[:10]}"
        ),
        vehicle_type=VehicleType.VAN,
        capacity_kg=capacity,
        status=VehicleStatus.AVAILABLE,
    )

    db.add(vehicle)
    db.flush()

    return vehicle


def make_default_capacity_config(
    db,
    user,
):
    key = "logistics.default_vehicle_capacity_kg"

    config = (
        db.query(Configuration)
        .filter(Configuration.key == key)
        .first()
    )

    if config is not None:
        return config, None

    config = Configuration(
        key=key,
        description="Default vehicle capacity",
        data_type="DECIMAL",
        scope="GLOBAL",
        is_active=True,
    )

    db.add(config)
    db.flush()

    version = ConfigurationVersion(
        configuration_id=config.id,
        version=1,
        value=250,
        status="ACTIVE",
        effective_from=(
            datetime.now(timezone.utc)
            - timedelta(minutes=1)
        ),
        created_by=user.id,
        reason="Vehicle integration test",
    )

    db.add(version)
    db.flush()

    config.current_version_id = version.id

    db.commit()

    return config, version


def cleanup(
    db,
    vehicle=None,
    user=None,
    config=None,
    version=None,
):
    if vehicle is not None:
        db.delete(vehicle)

    if version is not None:
        db.delete(version)
        db.flush()

    if config is not None:
        db.delete(config)
        db.flush()

    if user is not None:
        db.delete(user)

    db.commit()


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

def test_create_vehicle_with_explicit_capacity(db):
    vehicle = None

    try:
        data = VehicleCreate(
            registration_number=(
                f"KA-{uuid.uuid4().hex[:10]}"
            ),
            vehicle_type=VehicleType.VAN,
            capacity_kg=Decimal("175.50"),
        )

        vehicle = create_vehicle(
            db=db,
            data=data,
        )

        assert vehicle.id is not None
        assert vehicle.registration_number == (
            data.registration_number
        )
        assert vehicle.vehicle_type == (
            VehicleType.VAN
        )
        assert vehicle.capacity_kg == Decimal(
            "175.50"
        )
        assert vehicle.status == (
            VehicleStatus.AVAILABLE
        )

        saved = db.get(Vehicle, vehicle.id)

        assert saved is not None
        assert saved.capacity_kg == Decimal(
            "175.50"
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_create_vehicle_uses_default_capacity(
    db,
):
    user = make_user(db)
    vehicle = None
    config = None
    version = None

    try:
        config, version = make_default_capacity_config(
            db,
            user,
        )

        data = VehicleCreate(
            registration_number=(
                f"KA-{uuid.uuid4().hex[:10]}"
            ),
            vehicle_type=VehicleType.TRUCK,
        )

        vehicle = create_vehicle(
            db=db,
            data=data,
        )

        assert vehicle.capacity_kg == Decimal(
            "250.00"
        )

        saved = db.get(
            Vehicle,
            vehicle.id,
        )

        assert saved.capacity_kg == Decimal(
            "250.00"
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
            user=user,
            config=config,
            version=version,
        )


def test_create_vehicle_rejects_duplicate_registration(
    db,
):
    vehicle = make_vehicle(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_vehicle(
                db=db,
                data=VehicleCreate(
                    registration_number=(
                        vehicle.registration_number
                    ),
                    vehicle_type=VehicleType.VAN,
                    capacity_kg=Decimal("100"),
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Vehicle registration number already exists"
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

def test_get_vehicle_returns_vehicle(db):
    vehicle = make_vehicle(db)

    try:
        result = get_vehicle(
            db=db,
            vehicle_id=vehicle.id,
        )

        assert result.id == vehicle.id
        assert result.registration_number == (
            vehicle.registration_number
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_get_vehicle_rejects_missing_vehicle(db):
    with pytest.raises(HTTPException) as exc_info:
        get_vehicle(
            db=db,
            vehicle_id=999999999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == (
        "Vehicle not found"
    )


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

def test_list_vehicles_returns_created_vehicles(db):
    vehicle_a = make_vehicle(db)
    vehicle_b = make_vehicle(db)

    try:
        vehicles = list_vehicles(
            db=db,
            skip=0,
            limit=2,
        )

        ids = [vehicle.id for vehicle in vehicles]

        assert vehicle_a.id in ids
        assert vehicle_b.id in ids

    finally:
        cleanup(
            db,
            vehicle=vehicle_a,
        )

        cleanup(
            db,
            vehicle=vehicle_b,
        )


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

def test_update_vehicle_persists_changes(db):
    vehicle = make_vehicle(db)

    try:
        updated = update_vehicle(
            db=db,
            vehicle_id=vehicle.id,
            data=VehicleUpdate(
                registration_number=(
                    f"KA-{uuid.uuid4().hex[:10]}"
                ),
                vehicle_type=VehicleType.TRUCK,
                capacity_kg=Decimal("200.00"),
            ),
        )

        assert updated.vehicle_type == (
            VehicleType.TRUCK
        )
        assert updated.capacity_kg == Decimal(
            "200.00"
        )

        db.refresh(vehicle)

        assert vehicle.vehicle_type == (
            VehicleType.TRUCK
        )
        assert vehicle.capacity_kg == Decimal(
            "200.00"
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_update_vehicle_rejects_duplicate_registration(
    db,
):
    vehicle_a = make_vehicle(db)
    vehicle_b = make_vehicle(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            update_vehicle(
                db=db,
                vehicle_id=vehicle_b.id,
                data=VehicleUpdate(
                    registration_number=(
                        vehicle_a.registration_number
                    ),
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Vehicle registration number already exists"
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle_a,
        )

        cleanup(
            db,
            vehicle=vehicle_b,
        )


# ---------------------------------------------------------
# Status rules
# ---------------------------------------------------------

def test_unassigned_vehicle_cannot_be_marked_assigned(
    db,
):
    vehicle = make_vehicle(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            update_vehicle(
                db=db,
                vehicle_id=vehicle.id,
                data=VehicleUpdate(
                    status=VehicleStatus.ASSIGNED,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Vehicle must be assigned through "
            "the assignment endpoint"
        )

        db.refresh(vehicle)

        assert vehicle.status == (
            VehicleStatus.AVAILABLE
        )

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_assigned_vehicle_cannot_change_status(
    db,
):
    user = make_user(db)
    driver = None
    vehicle = None
    assignment = None

    try:
        driver = Driver(
            user_id=user.id,
            employee_id=(
                f"EMP-{uuid.uuid4().hex[:8]}"
            ),
            phone="9876543210",
            license_number=(
                f"LIC-{uuid.uuid4().hex[:8]}"
            ),
            status=DriverStatus.ACTIVE,
            is_available=False,
        )

        db.add(driver)
        db.flush()

        vehicle = make_vehicle(db)

        vehicle.status = VehicleStatus.ASSIGNED
        db.flush()

        assigned_at = datetime.now(timezone.utc)

        assignment = DriverVehicleAssignment(
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            assigned_at=assigned_at,
        )

        db.add(assignment)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            update_vehicle(
                db=db,
                vehicle_id=vehicle.id,
                data=VehicleUpdate(
                    status=VehicleStatus.MAINTENANCE,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Unassign the vehicle before "
            "changing its status"
        )

        db.refresh(vehicle)

        assert vehicle.status == (
            VehicleStatus.ASSIGNED
        )

    finally:
        cleanup(
            db,
            assignment=assignment,
            driver=driver,
            vehicle=vehicle,
            user=user,
        )


def test_assigned_vehicle_can_remain_assigned(
    db,
):
    user = make_user(db)
    driver = None
    vehicle = None
    assignment = None

    try:
        driver = Driver(
            user_id=user.id,
            employee_id=(
                f"EMP-{uuid.uuid4().hex[:8]}"
            ),
            phone="9876543210",
            license_number=(
                f"LIC-{uuid.uuid4().hex[:8]}"
            ),
            status=DriverStatus.ACTIVE,
            is_available=False,
        )

        db.add(driver)
        db.flush()

        vehicle = make_vehicle(db)

        vehicle.status = VehicleStatus.ASSIGNED
        db.flush()

        assignment = DriverVehicleAssignment(
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            assigned_at=datetime.now(timezone.utc),
        )

        db.add(assignment)
        db.commit()

        updated = update_vehicle(
            db=db,
            vehicle_id=vehicle.id,
            data=VehicleUpdate(
                status=VehicleStatus.ASSIGNED,
            ),
        )

        assert updated.status == (
            VehicleStatus.ASSIGNED
        )

    finally:
        cleanup(
            db,
            assignment=assignment,
            driver=driver,
            vehicle=vehicle,
            user=user,
        )