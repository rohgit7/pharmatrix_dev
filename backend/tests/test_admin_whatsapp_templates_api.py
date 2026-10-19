
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_whatsapp_templates import router
from app.core.auth import get_current_user
from app.models.user import UserRole


test_app = FastAPI()
test_app.include_router(router)

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


def test_list_templates_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    try:
        response = client.get(
            "/api/admin/whatsapp/templates"
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"
    finally:
        test_app.dependency_overrides[
            get_current_user
        ] = override_admin_user


def test_create_template_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    try:
        response = client.post(
            "/api/admin/whatsapp/templates",
            json={
                "notification_type": "PICKUP_CONFIRMED",
                "template_key": "test_template",
                "meta_template_name": "test_template",
                "language_code": "en",
                "parameter_keys": [],
                "is_active": True,
            },
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"
    finally:
        test_app.dependency_overrides[
            get_current_user
        ] = override_admin_user



def test_update_template_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    try:
        response = client.patch(
            "/api/admin/whatsapp/templates/1",
            json={"is_active": False},
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"
    finally:
        test_app.dependency_overrides[
            get_current_user
        ] = override_admin_user


def test_activate_template_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    try:
        response = client.post(
            "/api/admin/whatsapp/templates/1/activate"
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"
    finally:
        test_app.dependency_overrides[
            get_current_user
        ] = override_admin_user


def test_deactivate_template_rejects_non_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    try:
        response = client.post(
            "/api/admin/whatsapp/templates/1/deactivate"
        )

        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required"
    finally:
        test_app.dependency_overrides[
            get_current_user
        ] = override_admin_user
