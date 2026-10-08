from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import router
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
    auth_user_id="auth-admin-123",
    name="Admin User",
    email="admin@test.local",
    role=UserRole.ADMIN,
    is_active=True,
)

customer_user = SimpleNamespace(
    id=200,
    auth_user_id="auth-customer-123",
    name="Customer User",
    email="customer@test.local",
    role=UserRole.CUSTOMER,
    is_active=True,
)


def override_admin_user():
    return admin_user


def override_customer_user():
    return customer_user


# ---------------------------------------------------------
# Test client
# ---------------------------------------------------------

client = TestClient(test_app)


# ---------------------------------------------------------
# Login
# ---------------------------------------------------------

@patch(
    "app.api.auth.supabase.auth.sign_in_with_password"
)
def test_login_success(sign_in_mock):
    sign_in_mock.return_value = SimpleNamespace(
        session=SimpleNamespace(
            access_token="access-token-123",
            refresh_token="refresh-token-123",
        ),
        user=SimpleNamespace(
            id="auth-user-123",
        ),
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@test.local",
            "password": "correct-password",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["access_token"] == "access-token-123"
    assert body["refresh_token"] == "refresh-token-123"
    assert body["token_type"] == "bearer"
    assert body["user_id"] == "auth-user-123"

    sign_in_mock.assert_called_once_with(
        {
            "email": "admin@test.local",
            "password": "correct-password",
        }
    )


@patch(
    "app.api.auth.supabase.auth.sign_in_with_password"
)
def test_login_returns_401_for_invalid_credentials(
    sign_in_mock,
):
    sign_in_mock.side_effect = Exception(
        "Invalid login credentials"
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@test.local",
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401

    assert response.json()["detail"] == (
        "Invalid email or password"
    )


@patch(
    "app.api.auth.supabase.auth.sign_in_with_password"
)
def test_login_returns_401_when_supabase_returns_no_session(
    sign_in_mock,
):
    sign_in_mock.return_value = SimpleNamespace(
        session=None,
        user=SimpleNamespace(
            id="auth-user-123",
        ),
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@test.local",
            "password": "correct-password",
        },
    )

    assert response.status_code == 401

    assert response.json()["detail"] == "Login failed"


@patch(
    "app.api.auth.supabase.auth.sign_in_with_password"
)
def test_login_returns_401_when_supabase_returns_no_user(
    sign_in_mock,
):
    sign_in_mock.return_value = SimpleNamespace(
        session=SimpleNamespace(
            access_token="access-token-123",
            refresh_token="refresh-token-123",
        ),
        user=None,
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@test.local",
            "password": "correct-password",
        },
    )

    assert response.status_code == 401

    assert response.json()["detail"] == "Login failed"


def test_login_validates_required_fields():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@test.local",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# /me
# ---------------------------------------------------------

def test_get_me_returns_current_user():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/auth/me"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 100
    assert body["auth_user_id"] == "auth-admin-123"
    assert body["name"] == "Admin User"
    assert body["email"] == "admin@test.local"
    assert body["role"] == "ADMIN"
    assert body["is_active"] is True


def test_get_me_returns_customer_role():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/auth/me"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 200
    assert body["role"] == "CUSTOMER"
    assert body["is_active"] is True


def test_get_me_requires_authentication():
    test_app.dependency_overrides.pop(
        get_current_user,
        None,
    )

    response = client.get(
        "/api/auth/me"
    )

    assert response.status_code == 401

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user