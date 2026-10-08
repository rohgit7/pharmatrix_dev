from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_configuration_audit import router
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


test_app.dependency_overrides[
    get_current_user
] = override_admin_user


client = TestClient(test_app)


# ---------------------------------------------------------
# Dummy DB
# ---------------------------------------------------------

class DummyScalarResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class DummyDB:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self, query):
        return DummyScalarResult(self.rows)


# ---------------------------------------------------------
# Fixture
# ---------------------------------------------------------

def make_audit():
    return SimpleNamespace(
        id=1,
        configuration_id=10,
        configuration_version_id=5,
        change_request_id=20,
        actor_id=100,
        action="CONFIGURATION_UPDATED",
        old_value="50",
        new_value="75",
        reason="Updated pickup distance",
        change_reference="CHG-001",
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------
# List audits
# ---------------------------------------------------------

def test_list_configuration_audits_endpoint():
    audit = make_audit()

    db = DummyDB([audit])

    from app.core.database import get_db

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.get(
        "/api/admin/configuration/audit"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1

    assert body[0]["id"] == 1
    assert body[0]["configuration_id"] == 10
    assert body[0]["configuration_version_id"] == 5
    assert body[0]["change_request_id"] == 20
    assert body[0]["actor_id"] == 100
    assert body[0]["action"] == "CONFIGURATION_UPDATED"
    assert body[0]["old_value"] == "50"
    assert body[0]["new_value"] == "75"
    assert body[0]["reason"] == "Updated pickup distance"
    assert body[0]["change_reference"] == "CHG-001"

    test_app.dependency_overrides.pop(get_db)


# ---------------------------------------------------------
# Empty audit list
# ---------------------------------------------------------

def test_list_configuration_audits_returns_empty_list():
    from app.core.database import get_db

    db = DummyDB([])

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.get(
        "/api/admin/configuration/audit"
    )

    assert response.status_code == 200
    assert response.json() == []

    test_app.dependency_overrides.pop(get_db)


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_configuration_audit_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/configuration/audit"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Admin access required"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user