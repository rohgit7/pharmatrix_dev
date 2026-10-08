from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.admin_pickups import router
from app.core.auth import get_current_user
from app.models.enums import PickupPriority, PickupStatus, UserRole


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Users
# ---------------------------------------------------------

admin_user = SimpleNamespace(
    id=100,
    role=UserRole.ADMIN,
)

customer_user = SimpleNamespace(
    id=200,
    role=UserRole.CUSTOMER,
)


def override_admin_user():
    return admin_user


def override_customer_user():
    return customer_user


test_app.dependency_overrides[
    get_current_user
] = override_admin_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixture
# ---------------------------------------------------------

def make_pickup(
    *,
    status=PickupStatus.REQUESTED,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=1,
        pickup_code="PK-ADMIN001",
        customer_id=10,
        location_id=20,
        status=status,
        priority=PickupPriority.NORMAL,
        requested_date=now + timedelta(days=1),
        scheduled_date=None,
        notes="Admin pickup test",
        failure_reason=None,
        collected_at=None,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

@patch(
    "app.api.admin_pickups.list_all_pickups"
)
def test_admin_list_pickups(
    list_pickups_mock,
):
    pickup = make_pickup()

    list_pickups_mock.return_value = [
        pickup
    ]

    response = client.get(
        "/api/admin/pickups/"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 1
    assert body[0]["pickup_code"] == "PK-ADMIN001"
    assert body[0]["status"] == "REQUESTED"

    list_pickups_mock.assert_called_once()

    call_kwargs = list_pickups_mock.call_args.kwargs

    assert call_kwargs["db"] is not None
    assert call_kwargs["status_filter"] is None


@patch(
    "app.api.admin_pickups.list_all_pickups"
)
def test_admin_list_pickups_with_status_filter(
    list_pickups_mock,
):
    pickup = make_pickup(
        status=PickupStatus.SCHEDULED,
    )

    list_pickups_mock.return_value = [
        pickup
    ]

    response = client.get(
        "/api/admin/pickups/?status=SCHEDULED"
    )

    assert response.status_code == 200

    assert response.json()[0]["status"] == "SCHEDULED"

    call_kwargs = list_pickups_mock.call_args.kwargs

    assert call_kwargs["status_filter"] == (
        PickupStatus.SCHEDULED
    )


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

@patch(
    "app.api.admin_pickups.get_pickup_by_id"
)
def test_admin_get_pickup(
    get_pickup_mock,
):
    pickup = make_pickup()

    get_pickup_mock.return_value = pickup

    response = client.get(
        "/api/admin/pickups/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["pickup_code"] == "PK-ADMIN001"
    assert body["customer_id"] == 10

    get_pickup_mock.assert_called_once_with(
        db=get_pickup_mock.call_args.kwargs["db"],
        pickup_id=1,
    )


@patch(
    "app.api.admin_pickups.get_pickup_by_id"
)
def test_admin_get_pickup_not_found(
    get_pickup_mock,
):
    get_pickup_mock.side_effect = HTTPException(
        status_code=404,
        detail="Pickup not found",
    )

    response = client.get(
        "/api/admin/pickups/999"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "Pickup not found"
    )


# ---------------------------------------------------------
# Schedule
# ---------------------------------------------------------

@patch(
    "app.api.admin_pickups.schedule_pickup"
)
def test_admin_schedule_pickup(
    schedule_pickup_mock,
):
    scheduled_date = (
        datetime.now(timezone.utc)
        + timedelta(days=2)
    )

    pickup = make_pickup(
        status=PickupStatus.SCHEDULED,
    )
    pickup.scheduled_date = scheduled_date

    schedule_pickup_mock.return_value = pickup

    response = client.post(
        "/api/admin/pickups/1/schedule",
        json={
            "scheduled_date": scheduled_date.isoformat(),
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["status"] == "SCHEDULED"
    assert body["scheduled_date"] is not None

    schedule_pickup_mock.assert_called_once()

    call_kwargs = schedule_pickup_mock.call_args.kwargs

    assert call_kwargs["pickup_id"] == 1
    assert call_kwargs["scheduled_date"] is not None
    assert call_kwargs["db"] is not None


@patch(
    "app.api.admin_pickups.schedule_pickup"
)
def test_admin_schedule_pickup_propagates_service_error(
    schedule_pickup_mock,
):
    schedule_pickup_mock.side_effect = HTTPException(
        status_code=400,
        detail=(
            "Pickup cannot be scheduled from status COLLECTED"
        ),
    )

    response = client.post(
        "/api/admin/pickups/1/schedule",
        json={
            "scheduled_date": (
                datetime.now(timezone.utc)
                + timedelta(days=1)
            ).isoformat(),
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Pickup cannot be scheduled from status COLLECTED"
    )


def test_admin_schedule_requires_date():
    response = client.post(
        "/api/admin/pickups/1/schedule",
        json={},
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Cancel
# ---------------------------------------------------------

@patch(
    "app.api.admin_pickups.cancel_pickup"
)
def test_admin_cancel_pickup(
    cancel_pickup_mock,
):
    pickup = make_pickup(
        status=PickupStatus.CANCELLED,
    )
    pickup.failure_reason = "Customer requested cancellation"

    cancel_pickup_mock.return_value = pickup

    response = client.post(
        "/api/admin/pickups/1/cancel",
        json={
            "reason": "Customer requested cancellation",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["status"] == "CANCELLED"
    assert body["failure_reason"] == (
        "Customer requested cancellation"
    )

    cancel_pickup_mock.assert_called_once()

    call_kwargs = cancel_pickup_mock.call_args.kwargs

    assert call_kwargs["pickup_id"] == 1
    assert call_kwargs["reason"] == (
        "Customer requested cancellation"
    )
    assert call_kwargs["db"] is not None


@patch(
    "app.api.admin_pickups.cancel_pickup"
)
def test_admin_cancel_pickup_propagates_service_error(
    cancel_pickup_mock,
):
    cancel_pickup_mock.side_effect = HTTPException(
        status_code=400,
        detail=(
            "Pickup cannot be cancelled from status COLLECTED"
        ),
    )

    response = client.post(
        "/api/admin/pickups/1/cancel",
        json={
            "reason": "Cancel test",
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Pickup cannot be cancelled from status COLLECTED"
    )


def test_admin_cancel_requires_reason():
    response = client.post(
        "/api/admin/pickups/1/cancel",
        json={},
    )

    assert response.status_code == 422


def test_admin_cancel_rejects_empty_reason():
    response = client.post(
        "/api/admin/pickups/1/cancel",
        json={
            "reason": "",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_admin_pickup_list_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/pickups/"
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user


def test_admin_pickup_schedule_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.post(
        "/api/admin/pickups/1/schedule",
        json={
            "scheduled_date": (
                datetime.now(timezone.utc)
                + timedelta(days=1)
            ).isoformat(),
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user