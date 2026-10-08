from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_configuration import router
from app.core.auth import get_current_user
from app.models.user import UserRole


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Fake users
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


test_app.dependency_overrides[get_current_user] = override_admin_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_configuration():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=10,
        key="pickup.max_distance_km",
        description="Maximum pickup distance",
        data_type="INTEGER",
        scope="GLOBAL",
        scope_id=None,
        current_version_id=5,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def make_version():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=5,
        configuration_id=10,
        version=2,
        value="50",
        status="ACTIVE",
        effective_from=now,
        effective_until=None,
        created_by=100,
        approved_by=100,
        reason="Test configuration",
        change_reference="CHG-001",
        previous_version_id=4,
        rollback_of_version_id=None,
        created_at=now,
        approved_at=now,
    )


# ---------------------------------------------------------
# List configurations
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration.list_configurations"
)
def test_list_configurations_endpoint(
    list_configurations_mock,
):
    configuration = make_configuration()

    list_configurations_mock.return_value = [
        configuration
    ]

    response = client.get(
        "/api/admin/configuration"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 10
    assert body[0]["key"] == "pickup.max_distance_km"

    list_configurations_mock.assert_called_once()


# ---------------------------------------------------------
# Get configuration detail
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration.get_active_version"
)
@patch(
    "app.api.admin_configuration.get_configuration_detail"
)
def test_get_configuration_detail_endpoint(
    get_configuration_detail_mock,
    get_active_version_mock,
):
    configuration = make_configuration()
    version = make_version()

    get_configuration_detail_mock.return_value = (
        configuration,
        [version],
    )

    get_active_version_mock.return_value = version

    response = client.get(
        "/api/admin/configuration/pickup.max_distance_km"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 10
    assert body["key"] == "pickup.max_distance_km"
    assert body["current_version_id"] == 5
    assert body["current_version"]["id"] == 5

    get_configuration_detail_mock.assert_called_once_with(
        get_configuration_detail_mock.call_args.args[0],
        "pickup.max_distance_km",
    )

    get_active_version_mock.assert_called_once_with(
        get_active_version_mock.call_args.args[0],
        "pickup.max_distance_km",
    )


# ---------------------------------------------------------
# Configuration not found
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration.get_configuration_detail"
)
def test_get_configuration_returns_404_when_not_found(
    get_configuration_detail_mock,
):
    get_configuration_detail_mock.return_value = None

    response = client.get(
        "/api/admin/configuration/does.not.exist"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Configuration not found"
    )


# ---------------------------------------------------------
# Configuration history
# ---------------------------------------------------------

@patch(
    "app.api.admin_configuration.get_configuration_history"
)
def test_get_configuration_history_endpoint(
    get_configuration_history_mock,
):
    configuration = make_configuration()
    version = make_version()

    get_configuration_history_mock.return_value = (
        configuration,
        [version],
    )

    response = client.get(
        "/api/admin/configuration/pickup.max_distance_km/history"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["configuration"]["id"] == 10
    assert len(body["versions"]) == 1
    assert body["versions"][0]["id"] == 5

    get_configuration_history_mock.assert_called_once()


@patch(
    "app.api.admin_configuration.get_configuration_history"
)
def test_get_configuration_history_returns_404_when_not_found(
    get_configuration_history_mock,
):
    get_configuration_history_mock.return_value = None

    response = client.get(
        "/api/admin/configuration/does.not.exist/history"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Configuration not found"
    )


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_configuration_endpoint_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/configuration"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Admin access required"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user