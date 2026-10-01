from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_configuration_changes import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import UserRole


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Fake dependencies
# ---------------------------------------------------------

class DummyDB:
    def __init__(self, change=None):
        self.change = change

    def commit(self):
        pass

    def rollback(self):
        pass

    def refresh(self, obj):
        pass

    def get(self, model, object_id):
        return self.change


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


def override_db():
    return DummyDB()


test_app.dependency_overrides[get_current_user] = override_admin_user
test_app.dependency_overrides[get_db] = override_db

client = TestClient(test_app)


# ---------------------------------------------------------
# Response fixture
# ---------------------------------------------------------

def make_change():
    return SimpleNamespace(
        id=1,
        configuration_id=10,
        base_version_id=5,
        proposed_value="previous-value",
        status="PENDING_APPROVAL",
        risk_level="HIGH",
        reason="Scheduled rollback",
        change_reference="RB-001",
        effective_from=(
            datetime.now(timezone.utc)
            + timedelta(hours=2)
        ),
        created_by=100,
        approved_by=None,
        rejected_by=None,
        review_comment=None,
        created_at=datetime.now(timezone.utc),
        reviewed_at=None,
        rollback_of_version_id=4,
    )


# ---------------------------------------------------------
# Rollback endpoint
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration_changes.create_rollback_request"
)
def test_create_rollback_request_endpoint(
    create_rollback_mock,
):
    change = make_change()

    create_rollback_mock.return_value = change

    effective_from = (
        datetime.now(timezone.utc)
        + timedelta(hours=2)
    )

    response = client.post(
        "/api/admin/configuration/10/rollback",
        json={
            "rollback_to_version_id": 4,
            "reason": "Scheduled rollback",
            "change_reference": "RB-001",
            "effective_from": effective_from.isoformat(),
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["configuration_id"] == 10
    assert body["rollback_of_version_id"] == 4
    assert body["status"] == "PENDING_APPROVAL"
    assert body["risk_level"] == "HIGH"

    create_rollback_mock.assert_called_once()

    call_kwargs = create_rollback_mock.call_args.kwargs

    assert call_kwargs["configuration_id"] == 10
    assert call_kwargs["rollback_to_version_id"] == 4
    assert call_kwargs["reason"] == "Scheduled rollback"
    assert call_kwargs["created_by"] == 100
    assert call_kwargs["change_reference"] == "RB-001"
    assert call_kwargs["effective_from"] is not None


@patch(
    "app.api.admin_configuration_changes.create_rollback_request"
)
def test_rollback_endpoint_returns_400_for_service_validation_error(
    create_rollback_mock,
):
    create_rollback_mock.side_effect = ValueError(
        "effective_from cannot be in the past"
    )

    response = client.post(
        "/api/admin/configuration/10/rollback",
        json={
            "rollback_to_version_id": 4,
            "reason": "Rollback test",
            "effective_from": (
                datetime.now(timezone.utc)
                - timedelta(hours=1)
            ).isoformat(),
        },
    )

    assert response.status_code == 400

    body = response.json()

    assert body["detail"] == "effective_from cannot be in the past"


def test_rollback_endpoint_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.post(
        "/api/admin/configuration/10/rollback",
        json={
            "rollback_to_version_id": 4,
            "reason": "Rollback test",
        },
    )

    assert response.status_code == 403

    assert response.json()["detail"] == "Admin access required"

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user


def test_rollback_endpoint_validates_required_fields():
    response = client.post(
        "/api/admin/configuration/10/rollback",
        json={
            "reason": "Rollback test",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Approval endpoint
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration_changes.approve_change_request"
)
def test_approve_change_request_endpoint(
    approve_mock,
):
    change = make_change()

    # The endpoint ignores the service return value and
    # fetches the change again from the DB.
    db = DummyDB(change=change)

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.post(
        "/api/admin/configuration/change-requests/1/approve",
        json={
            "comment": "Approved by admin",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["configuration_id"] == 10
    assert body["rollback_of_version_id"] == 4

    approve_mock.assert_called_once()

    call_kwargs = approve_mock.call_args.kwargs

    assert call_kwargs["change_id"] == 1
    assert call_kwargs["approver_id"] == 100
    assert call_kwargs["comment"] == "Approved by admin"

    test_app.dependency_overrides[
        get_db
    ] = override_db


@patch(
    "app.api.admin_configuration_changes.approve_change_request"
)
def test_approve_endpoint_returns_400_for_service_error(
    approve_mock,
):
    approve_mock.side_effect = ValueError(
        "The maker cannot approve their own change"
    )

    response = client.post(
        "/api/admin/configuration/change-requests/1/approve",
        json={
            "comment": "Approve",
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "The maker cannot approve their own change"
    )