from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.api.auth import router
from app.core.rate_limiter import limiter
from types import SimpleNamespace
from app.models.user import UserRole
from datetime import datetime, timedelta, timezone
from app.api.driver_route_execution import router as driver_router

from app.api.pickups import router as pickups_router
from app.core.auth import get_current_user
from app.core.database import get_db

test_app = FastAPI()
test_app.state.limiter = limiter
test_app.include_router(router)

test_app.add_exception_handler(
    429,
    lambda request, exc: __import__(
        "slowapi"
    )._rate_limit_exceeded_handler(request, exc),
)

client = TestClient(test_app)


def setup_function():
    limiter.reset()

@patch("app.api.auth.supabase.auth.sign_in_with_password")
def test_login_rate_limit_returns_429(sign_in_mock):
    responses = []

    sign_in_mock.return_value = SimpleNamespace(
        session=None,
        user=None,
    )
    for _ in range(6):
        responses.append(
            client.post(
                "/api/auth/login",
                json={
                    "email": "rate-limit-test@example.com",
                    "password": "invalid-password",
                },
            )
        )

    assert all(
        response.status_code == 401
        for response in responses[:5]
    )
    assert responses[5].status_code == 429


pickup_test_app = FastAPI()
pickup_test_app.state.limiter = limiter
pickup_test_app.include_router(pickups_router)

pickup_test_app.dependency_overrides[get_current_user] = (
    lambda: SimpleNamespace(
        id=200,
        role=UserRole.CUSTOMER,
    )
)
pickup_test_app.dependency_overrides[get_db] = lambda: None

pickup_client = TestClient(pickup_test_app)


def test_pickup_otp_rate_limit_returns_429():
    limiter.reset()
    responses = []

    with patch(
        "app.api.pickups.request_otp",
        return_value=(
            SimpleNamespace(
                public_id="00000000-0000-0000-0000-000000000001",
                otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            ),
            "123456",
        ),
    ):
        for _ in range(4):
            responses.append(
                pickup_client.post(
                    "/api/pickups/00000000-0000-0000-0000-000000000001/verification/request-otp"
                )
            )

    assert all(
        response.status_code == 200
        for response in responses[:3]
    )
    assert responses[3].status_code == 429
driver_test_app = FastAPI()
driver_test_app.state.limiter = limiter
driver_test_app.include_router(driver_router)

driver_test_app.dependency_overrides[get_db] = lambda: None
driver_test_app.dependency_overrides[get_current_user] = (
    lambda: SimpleNamespace(
        id=300,
        role=UserRole.DRIVER,
    )
)

# Override the router-level role check
for dependency in driver_router.dependencies:
    driver_test_app.dependency_overrides[dependency.dependency] = (
        lambda: SimpleNamespace(
            id=300,
            role=UserRole.DRIVER,
        )
    )

driver_client = TestClient(driver_test_app)


def test_driver_otp_rate_limit_returns_429():
    limiter.reset()
    responses = []

    with patch(
        "app.api.driver_route_execution.verify_otp",
        return_value=SimpleNamespace(
            id=1,
            execution_status="completed",
        ),
    ):
        for _ in range(6):
            responses.append(
                driver_client.post(
                    "/api/driver/routes/1/stops/1/verify-otp",
                    json={"otp": "123456"},
                )
            )

    assert all(
        response.status_code != 429
        for response in responses[:5]
    )
    assert responses[5].status_code == 429