from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.pickups import router
from app.core.auth import get_current_user
from app.models.enums import UserRole

PICKUP_PUBLIC_ID = UUID("1f818c3d-d8d5-45e7-9079-f99180d9634f")


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)

customer_user = SimpleNamespace(
    id=100,
    role=UserRole.CUSTOMER,
)


def override_customer_user():
    return customer_user


test_app.dependency_overrides[
    get_current_user
] = override_customer_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_pickup():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=10,
        public_id=PICKUP_PUBLIC_ID,
        pickup_code="PK-VERIFY001",
        verification_token="verification-token-123456",
        qr_verified_at=None,
        otp_verified_at=None,
        otp_expires_at=now + timedelta(minutes=10),
    )


# ---------------------------------------------------------
# GET verification details
# ---------------------------------------------------------

@patch(
    "app.api.pickups.get_verification_details"
)
def test_get_pickup_verification_endpoint(
    get_verification_mock,
):
    pickup = make_pickup()

    get_verification_mock.return_value = pickup

    response = client.get(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["pickup_id"] == str(PICKUP_PUBLIC_ID)
    assert body["pickup_code"] == "PK-VERIFY001"
    assert body["verification_token"] == (
        "verification-token-123456"
    )
    assert body["qr_verified"] is False
    assert body["qr_verified_at"] is None
    assert body["otp_verified"] is False
    assert body["otp_verified_at"] is None
    assert body["otp_expires_at"] is not None

    get_verification_mock.assert_called_once()

    call_kwargs = get_verification_mock.call_args.kwargs

    assert call_kwargs["user"] is customer_user
    assert call_kwargs["pickup_id"] == PICKUP_PUBLIC_ID
    assert call_kwargs["db"] is not None


@patch(
    "app.api.pickups.get_verification_details"
)
def test_get_pickup_verification_propagates_not_found(
    get_verification_mock,
):
    get_verification_mock.side_effect = HTTPException(
        status_code=404,
        detail="Pickup not found",
    )

    response = client.get(
        f"/api/pickups/{UUID('cfc3b1c4-5077-4d6a-8c77-093658d73062')}/verification"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Pickup not found"
    )


# ---------------------------------------------------------
# Request OTP
# ---------------------------------------------------------

@patch(
    "app.api.pickups.request_otp"
)
def test_request_pickup_otp_endpoint(
    request_otp_mock,
):
    pickup = make_pickup()

    otp = "123456"

    request_otp_mock.return_value = (
        pickup,
        otp,
    )

    response = client.post(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification/request-otp"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["pickup_id"] == str(PICKUP_PUBLIC_ID)
    assert body["otp"] == "123456"
    assert body["expires_at"] is not None
    assert body["message"] == (
        "OTP generated for development. "
        "Production delivery will use the customer "
        "notification channel."
    )

    request_otp_mock.assert_called_once()

    call_kwargs = request_otp_mock.call_args.kwargs

    assert call_kwargs["user"] is customer_user
    assert call_kwargs["pickup_id"] == PICKUP_PUBLIC_ID
    assert call_kwargs["db"] is not None


@patch(
    "app.api.pickups.request_otp"
)
def test_request_otp_propagates_cancelled_pickup_error(
    request_otp_mock,
):
    request_otp_mock.side_effect = HTTPException(
        status_code=400,
        detail="OTP cannot be generated for this pickup",
    )

    response = client.post(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification/request-otp"
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "OTP cannot be generated for this pickup"
    )


@patch(
    "app.api.pickups.request_otp"
)
def test_request_otp_propagates_cooldown_error(
    request_otp_mock,
):
    request_otp_mock.side_effect = HTTPException(
        status_code=429,
        detail="Please wait before requesting another OTP",
    )

    response = client.post(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification/request-otp"
    )

    assert response.status_code == 429

    assert response.json()["detail"] == (
        "Please wait before requesting another OTP"
    )


@patch(
    "app.api.pickups.request_otp"
)
def test_request_otp_propagates_rate_limit_error(
    request_otp_mock,
):
    request_otp_mock.side_effect = HTTPException(
        status_code=429,
        detail=(
            "Maximum OTP requests exceeded. "
            "Please try again later."
        ),
    )

    response = client.post(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification/request-otp"
    )

    assert response.status_code == 429

    assert response.json()["detail"] == (
        "Maximum OTP requests exceeded. "
        "Please try again later."
    )


# ---------------------------------------------------------
# OTP endpoint response shape
# ---------------------------------------------------------

@patch(
    "app.api.pickups.request_otp"
)
def test_request_otp_response_contains_six_digit_otp(
    request_otp_mock,
):
    pickup = make_pickup()

    request_otp_mock.return_value = (
        pickup,
        "654321",
    )

    response = client.post(
        f"/api/pickups/{PICKUP_PUBLIC_ID}/verification/request-otp"
    )

    assert response.status_code == 200

    otp = response.json()["otp"]

    assert len(otp) == 6
    assert otp.isdigit() is True