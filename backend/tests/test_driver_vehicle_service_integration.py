import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import DriverStatus, UserRole, VehicleStatus, VehicleType
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.driver_vehicle_service import (
    assign_vehicle_to_driver,
    get_driver_active_vehicle,
    get_driver_assignment_history,
    get_vehicle_active_driver,
    unassign_vehicle_from_driver,
)


# ---------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------


def make_driver(db):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Assignment Driver {uuid.uuid4().hex[:8]}",
        email=f"assignment-{uuid.uuid4().hex}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    driver = Driver(
        user_id=user.id,
        employee_id=f"EMP-{uuid.uuid4().hex[:8]}",
        phone="9876543210",
        license_number=f"LIC-{uuid.uuid4().hex[:8]}",
        status=DriverStatus.ACTIVE,
        is_available=True,
    )

    db.add(driver)
    db.flush()

    return user, driver


def make_vehicle(db):
    vehicle = Vehicle(
        registration_number=f"KA-{uuid.uuid4().hex[:10]}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=100,
        status=VehicleStatus.AVAILABLE,
    )

    db.add(vehicle)
    db.flush()

    return vehicle


def cleanup(
    db,
    *,
    user=None,
    driver=None,
    vehicle=None,
    assignment=None,
    assignments=None,
):
    if assignments:
        for item in assignments:
            if item is not None:
                db.delete(item)

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
# Assign vehicle
# ---------------------------------------------------------


def test_assign_vehicle_to_driver(db):
    user, driver = make_driver(db)
    vehicle = make_vehicle(db)
    assignment = None

    try:
        assignment = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            notes="Integration test assignment",
        )

        assert assignment.id is not None
        assert assignment.driver_id == driver.id
        assert assignment.vehicle_id == vehicle.id
        assert assignment.unassigned_at is None
        assert assignment.notes == "Integration test assignment"

        db.refresh(vehicle)

        assert vehicle.status == VehicleStatus.ASSIGNED

        active_driver_assignment = get_driver_active_vehicle(
            db,
            driver.id,
        )

        assert active_driver_assignment is not None
        assert active_driver_assignment.id == assignment.id

        active_vehicle_assignment = get_vehicle_active_driver(
            db,
            vehicle.id,
        )

        assert active_vehicle_assignment is not None
        assert active_vehicle_assignment.id == assignment.id

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle,
            assignment=assignment,
        )


def test_assign_vehicle_rejects_missing_driver(db):
    vehicle = make_vehicle(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=999999999,
                vehicle_id=vehicle.id,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Driver not found"

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_assign_vehicle_rejects_missing_vehicle(db):
    user, driver = make_driver(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver.id,
                vehicle_id=999999999,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Vehicle not found"

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
        )


def test_assign_vehicle_rejects_inactive_driver(db):
    user, driver = make_driver(db)
    vehicle = make_vehicle(db)

    try:
        driver.status = DriverStatus.INACTIVE
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver.id,
                vehicle_id=vehicle.id,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Driver is not active"

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle,
        )


def test_assign_vehicle_rejects_unavailable_driver(db):
    user, driver = make_driver(db)
    vehicle = make_vehicle(db)

    try:
        driver.is_available = False
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver.id,
                vehicle_id=vehicle.id,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Driver is not available"

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle,
        )


@pytest.mark.parametrize(
    "vehicle_status, expected_detail",
    [
        (
            VehicleStatus.MAINTENANCE,
            "Vehicle is maintenance",
        ),
        (
            VehicleStatus.INACTIVE,
            "Vehicle is inactive",
        ),
    ],
)
def test_assign_vehicle_rejects_unusable_vehicle(
    db,
    vehicle_status,
    expected_detail,
):
    user, driver = make_driver(db)
    vehicle = make_vehicle(db)

    try:
        vehicle.status = vehicle_status
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver.id,
                vehicle_id=vehicle.id,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == expected_detail

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle,
        )


def test_assign_vehicle_rejects_driver_with_active_assignment(db):
    user, driver = make_driver(db)
    vehicle_a = make_vehicle(db)
    vehicle_b = make_vehicle(db)

    assignment = None

    try:
        assignment = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle_a.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver.id,
                vehicle_id=vehicle_b.id,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Driver already has an active vehicle assignment"
        )

        db.refresh(vehicle_a)
        db.refresh(vehicle_b)

        assert vehicle_a.status == VehicleStatus.ASSIGNED
        assert vehicle_b.status == VehicleStatus.AVAILABLE

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle_a,
            assignment=assignment,
        )

        db.delete(vehicle_b)
        db.commit()


def test_assign_vehicle_rejects_already_assigned_vehicle(db):
    user_a, driver_a = make_driver(db)
    user_b, driver_b = make_driver(db)
    vehicle = make_vehicle(db)

    assignment = None

    try:
        assignment = assign_vehicle_to_driver(
            db=db,
            driver_id=driver_a.id,
            vehicle_id=vehicle.id,
        )

        with pytest.raises(HTTPException) as exc_info:
            assign_vehicle_to_driver(
                db=db,
                driver_id=driver_b.id,
                vehicle_id=vehicle.id,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Vehicle is already assigned to another driver"
        )

        db.refresh(vehicle)

        assert vehicle.status == VehicleStatus.ASSIGNED

        active_assignment = get_vehicle_active_driver(
            db,
            vehicle.id,
        )

        assert active_assignment is not None
        assert active_assignment.driver_id == driver_a.id

    finally:
        cleanup(
            db,
            user=user_a,
            driver=driver_a,
            vehicle=vehicle,
            assignment=assignment,
        )

        cleanup(
            db,
            user=user_b,
            driver=driver_b,
        )


# ---------------------------------------------------------
# Unassign vehicle
# ---------------------------------------------------------


def test_unassign_vehicle_from_driver(db):
    user, driver = make_driver(db)
    vehicle = make_vehicle(db)
    assignment = None

    try:
        assignment = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle.id,
        )

        unassigned = unassign_vehicle_from_driver(
            db=db,
            driver_id=driver.id,
        )

        assert unassigned.id == assignment.id
        assert unassigned.unassigned_at is not None
        assert unassigned.unassigned_at > unassigned.assigned_at

        db.refresh(vehicle)

        assert vehicle.status == VehicleStatus.AVAILABLE

        active_assignment = get_driver_active_vehicle(
            db,
            driver.id,
        )

        assert active_assignment is None

        active_vehicle_assignment = get_vehicle_active_driver(
            db,
            vehicle.id,
        )

        assert active_vehicle_assignment is None

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle,
            assignment=assignment,
        )


def test_unassign_vehicle_rejects_driver_without_active_assignment(db):
    user, driver = make_driver(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            unassign_vehicle_from_driver(
                db=db,
                driver_id=driver.id,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == (
            "Driver has no active vehicle assignment"
        )

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
        )


def test_unassign_vehicle_allows_future_reassignment(db):
    user, driver = make_driver(db)
    vehicle_a = make_vehicle(db)
    vehicle_b = make_vehicle(db)

    assignment_a = None
    assignment_b = None

    try:
        assignment_a = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle_a.id,
        )

        unassigned = unassign_vehicle_from_driver(
            db=db,
            driver_id=driver.id,
        )

        assert unassigned.id == assignment_a.id
        assert unassigned.unassigned_at is not None

        assignment_b = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle_b.id,
        )

        assert assignment_b.id != assignment_a.id
        assert assignment_b.driver_id == driver.id
        assert assignment_b.vehicle_id == vehicle_b.id

        db.refresh(vehicle_a)
        db.refresh(vehicle_b)

        assert vehicle_a.status == VehicleStatus.AVAILABLE
        assert vehicle_b.status == VehicleStatus.ASSIGNED

        active_assignment = get_driver_active_vehicle(
            db,
            driver.id,
        )

        assert active_assignment is not None
        assert active_assignment.id == assignment_b.id

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle_a,
            assignment=assignment_a,
        )

        cleanup(
            db,
            vehicle=vehicle_b,
            assignment=assignment_b,
        )


# ---------------------------------------------------------
# Assignment lookup
# ---------------------------------------------------------


def test_get_driver_active_vehicle_returns_none_without_assignment(db):
    user, driver = make_driver(db)

    try:
        result = get_driver_active_vehicle(
            db,
            driver.id,
        )

        assert result is None

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
        )


def test_get_vehicle_active_driver_returns_none_without_assignment(db):
    vehicle = make_vehicle(db)

    try:
        result = get_vehicle_active_driver(
            db,
            vehicle.id,
        )

        assert result is None

    finally:
        cleanup(
            db,
            vehicle=vehicle,
        )


def test_get_driver_assignment_history_returns_latest_first(db):
    user, driver = make_driver(db)
    vehicle_a = make_vehicle(db)
    vehicle_b = make_vehicle(db)

    assignment_a = None
    assignment_b = None

    try:
        assignment_a = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle_a.id,
        )

        unassign_vehicle_from_driver(
            db=db,
            driver_id=driver.id,
        )

        assignment_b = assign_vehicle_to_driver(
            db=db,
            driver_id=driver.id,
            vehicle_id=vehicle_b.id,
        )

        history = get_driver_assignment_history(
            db,
            driver.id,
        )

        assert len(history) == 2
        assert history[0].id == assignment_b.id
        assert history[1].id == assignment_a.id

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
            vehicle=vehicle_a,
            assignment=assignment_a,
        )

        cleanup(
            db,
            vehicle=vehicle_b,
            assignment=assignment_b,
        )


def test_get_driver_assignment_history_returns_empty_list(db):
    user, driver = make_driver(db)

    try:
        history = get_driver_assignment_history(
            db,
            driver.id,
        )

        assert history == []

    finally:
        cleanup(
            db,
            user=user,
            driver=driver,
        )