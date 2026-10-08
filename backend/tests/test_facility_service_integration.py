import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.enums import UserRole
from app.models.facility import Facility
from app.models.user import User
from app.schemas.facility import FacilityCreate, FacilityUpdate
from app.services.facility_service import (
    create_facility,
    get_facility,
    list_facilities,
    update_facility,
)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def make_user(db, role=UserRole.FACILITY):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Facility Test User {suffix}",
        email=f"facility-{suffix}@test.local",
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_facility_data(user_id):
    suffix = uuid.uuid4().hex[:10]

    return FacilityCreate(
        user_id=user_id,
        facility_code=f"FAC-{suffix}",
        legal_name=f"Test Disposal Facility {suffix}",
        phone="9876543210",
        email=f"facility-{suffix}@test.local",
        license_number=f"LIC-{suffix}",
        license_expiry=datetime(
            2030,
            12,
            31,
            tzinfo=timezone.utc,
        ),
        address="Facility Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560020",
        latitude=12.9716,
        longitude=77.5946,
    )


def cleanup(
    db,
    *,
    facility=None,
    user=None,
):
    if facility is not None:
        db.delete(facility)

    if user is not None:
        db.delete(user)

    db.commit()


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

def test_create_facility_persists_data(db):
    user = make_user(db)
    facility = None

    try:
        data = make_facility_data(user.id)

        facility = create_facility(
            db=db,
            data=data,
        )

        assert facility.id is not None
        assert facility.user_id == user.id
        assert facility.facility_code == (
            data.facility_code
        )
        assert facility.legal_name == (
            data.legal_name
        )
        assert facility.license_number == (
            data.license_number
        )
        assert facility.city == data.city
        assert facility.state == data.state
        assert facility.postal_code == (
            data.postal_code
        )
        assert float(facility.latitude) == pytest.approx(
            data.latitude
        )
        assert float(facility.longitude) == pytest.approx(
            data.longitude
        )
        assert facility.active is True

        saved = db.get(
            Facility,
            facility.id,
        )

        assert saved is not None
        assert saved.user_id == user.id

    finally:
        cleanup(
            db,
            facility=facility,
            user=user,
        )


def test_create_facility_rejects_missing_user(db):
    data = make_facility_data(999999999)

    with pytest.raises(HTTPException) as exc_info:
        create_facility(
            db=db,
            data=data,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == (
        "User not found"
    )


def test_create_facility_rejects_non_facility_user(
    db,
):
    user = make_user(
        db,
        role=UserRole.CUSTOMER,
    )

    try:
        data = make_facility_data(user.id)

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "User must have FACILITY role"
        )

    finally:
        cleanup(
            db,
            user=user,
        )


def test_create_facility_rejects_duplicate_user(
    db,
):
    user = make_user(db)

    facility_a = None

    try:
        data_a = make_facility_data(user.id)

        facility_a = create_facility(
            db=db,
            data=data_a,
        )

        data_b = make_facility_data(user.id)

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data_b,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Facility already exists for this user"
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user,
        )


def test_create_facility_rejects_duplicate_code(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        data_a = make_facility_data(user_a.id)

        facility_a = create_facility(
            db=db,
            data=data_a,
        )

        data_b = make_facility_data(user_b.id)
        data_b.facility_code = (
            data_a.facility_code
        )

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data_b,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Facility code already exists"
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_create_facility_rejects_duplicate_license(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        data_a = make_facility_data(user_a.id)

        facility_a = create_facility(
            db=db,
            data=data_a,
        )

        data_b = make_facility_data(user_b.id)
        data_b.license_number = (
            data_a.license_number
        )

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data_b,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Facility license already exists"
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_create_facility_rejects_invalid_latitude(
    db,
):
    user = make_user(db)

    try:
        data = make_facility_data(user.id)
        data.latitude = 91

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid latitude"
        )

    finally:
        cleanup(
            db,
            user=user,
        )


def test_create_facility_rejects_invalid_longitude(
    db,
):
    user = make_user(db)

    try:
        data = make_facility_data(user.id)
        data.longitude = 181

        with pytest.raises(HTTPException) as exc_info:
            create_facility(
                db=db,
                data=data,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid longitude"
        )

    finally:
        cleanup(
            db,
            user=user,
        )


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

def test_get_facility_returns_persisted_facility(
    db,
):
    user = make_user(db)
    facility = None

    try:
        facility = create_facility(
            db=db,
            data=make_facility_data(user.id),
        )

        result = get_facility(
            db=db,
            facility_id=facility.id,
        )

        assert result.id == facility.id
        assert result.user_id == user.id
        assert result.facility_code == (
            facility.facility_code
        )

    finally:
        cleanup(
            db,
            facility=facility,
            user=user,
        )


def test_get_facility_rejects_missing_facility(db):
    with pytest.raises(HTTPException) as exc_info:
        get_facility(
            db=db,
            facility_id=999999999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == (
        "Facility not found"
    )


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

def test_list_facilities_excludes_inactive_by_default(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        facility_a = create_facility(
            db=db,
            data=make_facility_data(user_a.id),
        )

        facility_b = create_facility(
            db=db,
            data=make_facility_data(user_b.id),
        )

        facility_b.active = False
        db.commit()

        facilities = list_facilities(
            db=db,
            include_inactive=False,
        )

        ids = [facility.id for facility in facilities]

        assert facility_a.id in ids
        assert facility_b.id not in ids

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_list_facilities_can_include_inactive(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        facility_a = create_facility(
            db=db,
            data=make_facility_data(user_a.id),
        )

        facility_b = create_facility(
            db=db,
            data=make_facility_data(user_b.id),
        )

        facility_b.active = False
        db.commit()

        facilities = list_facilities(
            db=db,
            include_inactive=True,
        )

        ids = [facility.id for facility in facilities]

        assert facility_a.id in ids
        assert facility_b.id in ids

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_list_facilities_orders_by_legal_name(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        data_a = make_facility_data(user_a.id)
        data_b = make_facility_data(user_b.id)

        data_a.legal_name = "AAA Facility"
        data_b.legal_name = "ZZZ Facility"

        facility_a = create_facility(
            db=db,
            data=data_a,
        )

        facility_b = create_facility(
            db=db,
            data=data_b,
        )

        facilities = list_facilities(
            db=db,
            include_inactive=True,
        )

        ids = [facility.id for facility in facilities]

        assert ids.index(facility_a.id) < ids.index(
            facility_b.id
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

def test_update_facility_persists_changes(db):
    user = make_user(db)
    facility = None

    try:
        facility = create_facility(
            db=db,
            data=make_facility_data(user.id),
        )

        updated = update_facility(
            db=db,
            facility_id=facility.id,
            data=FacilityUpdate(
                legal_name="Updated Facility",
                city="Mysuru",
                phone="9999999999",
                latitude=13.3409,
                active=False,
            ),
        )

        assert updated.legal_name == (
            "Updated Facility"
        )
        assert updated.city == "Mysuru"
        assert updated.phone == "9999999999"
        assert float(updated.latitude) == pytest.approx(
            13.3409
        )
        assert updated.active is False

        db.refresh(facility)

        assert facility.legal_name == (
            "Updated Facility"
        )
        assert facility.city == "Mysuru"
        assert facility.active is False

    finally:
        cleanup(
            db,
            facility=facility,
            user=user,
        )


def test_update_facility_rejects_duplicate_code(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        facility_a = create_facility(
            db=db,
            data=make_facility_data(user_a.id),
        )

        facility_b = create_facility(
            db=db,
            data=make_facility_data(user_b.id),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_facility(
                db=db,
                facility_id=facility_b.id,
                data=FacilityUpdate(
                    facility_code=(
                        facility_a.facility_code
                    ),
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Facility code already exists"
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_update_facility_rejects_duplicate_license(
    db,
):
    user_a = make_user(db)
    user_b = make_user(db)

    facility_a = None
    facility_b = None

    try:
        facility_a = create_facility(
            db=db,
            data=make_facility_data(user_a.id),
        )

        facility_b = create_facility(
            db=db,
            data=make_facility_data(user_b.id),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_facility(
                db=db,
                facility_id=facility_b.id,
                data=FacilityUpdate(
                    license_number=(
                        facility_a.license_number
                    ),
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Facility license already exists"
        )

    finally:
        cleanup(
            db,
            facility=facility_a,
            user=user_a,
        )

        cleanup(
            db,
            facility=facility_b,
            user=user_b,
        )


def test_update_facility_rejects_invalid_latitude(
    db,
):
    user = make_user(db)
    facility = None

    try:
        facility = create_facility(
            db=db,
            data=make_facility_data(user.id),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_facility(
                db=db,
                facility_id=facility.id,
                data=FacilityUpdate(
                    latitude=91,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid latitude"
        )

    finally:
        cleanup(
            db,
            facility=facility,
            user=user,
        )


def test_update_facility_rejects_invalid_longitude(
    db,
):
    user = make_user(db)
    facility = None

    try:
        facility = create_facility(
            db=db,
            data=make_facility_data(user.id),
        )

        with pytest.raises(HTTPException) as exc_info:
            update_facility(
                db=db,
                facility_id=facility.id,
                data=FacilityUpdate(
                    longitude=181,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid longitude"
        )

    finally:
        cleanup(
            db,
            facility=facility,
            user=user,
        )