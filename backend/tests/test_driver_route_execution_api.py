from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.driver_route_execution import router
from app.core.auth import get_current_user
from app.models.enums import (
    RouteStatus,
    RouteStopStatus,
    UserRole,
)


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Users
# ---------------------------------------------------------

driver_user = SimpleNamespace(
    id=100,
    role=UserRole.DRIVER,
)

customer_user = SimpleNamespace(
    id=200,
    role=UserRole.CUSTOMER,
)


def override_driver_user():
    return driver_user


def override_customer_user():
    return customer_user


test_app.dependency_overrides[
    get_current_user
] = override_driver_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def make_route():
    return SimpleNamespace(
        id=10,
        status=RouteStatus.IN_PROGRESS,
    )


def make_stop(
    *,
    stop_id=501,
    status=RouteStopStatus.ARRIVED,
):
    return SimpleNamespace(
        id=stop_id,
        execution_status=status,
        arrived_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        proof_uploaded_at=datetime.now(timezone.utc),
        failure_reason=None,
    )


# ---------------------------------------------------------
# Start route
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.start_route"
)
def test_start_route_endpoint(
    start_route_mock,
):
    route = make_route()
    start_route_mock.return_value = route

    response = client.post(
        "/api/driver/routes/10/start"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == "Route started"
    assert body["route_id"] == 10
    assert body["status"] == "IN_PROGRESS"

    start_route_mock.assert_called_once()

    kwargs = start_route_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


@patch(
    "app.api.driver_route_execution.start_route"
)
def test_start_route_propagates_service_error(
    start_route_mock,
):
    start_route_mock.side_effect = HTTPException(
        status_code=400,
        detail="Route cannot be started",
    )

    response = client.post(
        "/api/driver/routes/10/start"
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Route cannot be started"
    )


# ---------------------------------------------------------
# Arrive at stop
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.arrive_at_stop"
)
def test_arrive_at_stop_endpoint(
    arrive_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.ARRIVED,
    )

    arrive_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/arrive"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == (
        "Driver arrived at stop"
    )
    assert body["stop_id"] == 501
    assert body["status"] == "ARRIVED"
    assert body["arrived_at"] is not None

    arrive_mock.assert_called_once()

    kwargs = arrive_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


# ---------------------------------------------------------
# Complete stop
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.complete_stop"
)
def test_complete_stop_endpoint(
    complete_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.COMPLETED,
    )

    complete_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/complete",
        json={
            "collected_weight_kg": 12.5,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == "Stop completed"
    assert body["stop_id"] == 501
    assert body["status"] == "COMPLETED"
    assert body["completed_at"] is not None

    complete_mock.assert_called_once()

    kwargs = complete_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["collected_weight_kg"] == 12.5
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


def test_complete_stop_validates_weight():
    response = client.post(
        "/api/driver/routes/10/stops/501/complete",
        json={
            "collected_weight_kg": -1,
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Fail stop
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.fail_stop"
)
def test_fail_stop_endpoint(
    fail_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.FAILED,
    )

    stop.failure_reason = "Customer unavailable"

    fail_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/fail",
        json={
            "reason": "Customer unavailable",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == (
        "Stop marked as failed"
    )
    assert body["stop_id"] == 501
    assert body["status"] == "FAILED"
    assert body["reason"] == "Customer unavailable"

    fail_mock.assert_called_once()

    kwargs = fail_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["reason"] == (
        "Customer unavailable"
    )
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


def test_fail_stop_requires_reason():
    response = client.post(
        "/api/driver/routes/10/stops/501/fail",
        json={
            "reason": "",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# QR verification
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.verify_qr"
)
def test_scan_pickup_qr_endpoint(
    verify_qr_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.ARRIVED,
    )

    verify_qr_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/scan-qr",
        json={
            "qr_token": "pickup-secret-token",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == (
        "Pickup QR verified"
    )
    assert body["stop_id"] == 501
    assert body["status"] == "ARRIVED"
    assert body["otp_required"] is True
    assert body["arrived_at"] is not None

    verify_qr_mock.assert_called_once()

    kwargs = verify_qr_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["qr_token"] == (
        "pickup-secret-token"
    )
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


# ---------------------------------------------------------
# OTP verification
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.verify_otp"
)
def test_verify_pickup_otp_endpoint(
    verify_otp_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.IN_PROGRESS,
    )

    verify_otp_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/verify-otp",
        json={
            "otp": "123456",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == (
        "Customer OTP verified"
    )
    assert body["stop_id"] == 501
    assert body["status"] == "IN_PROGRESS"
    assert body["otp_verified"] is True

    verify_otp_mock.assert_called_once()

    kwargs = verify_otp_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["otp"] == "123456"
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


# ---------------------------------------------------------
# Collection proof upload
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.upload_collection_proof",
    new_callable=AsyncMock,
)
def test_upload_collection_proof_endpoint(
    upload_mock,
):
    stop = make_stop(
        stop_id=501,
        status=RouteStopStatus.IN_PROGRESS,
    )

    upload_mock.return_value = stop

    response = client.post(
        "/api/driver/routes/10/stops/501/proof",
        files={
            "file": (
                "proof.jpg",
                b"\xff\xd8\xff\xdbfake-image",
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["message"] == (
        "Collection proof uploaded successfully"
    )
    assert body["stop_id"] == 501
    assert body["proof_uploaded"] is True
    assert body["proof_uploaded_at"] is not None

    upload_mock.assert_called_once()

    kwargs = upload_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None

    uploaded_file = kwargs["file"]

    assert uploaded_file.filename == "proof.jpg"
    assert uploaded_file.content_type == "image/jpeg"


# ---------------------------------------------------------
# Proof URL
# ---------------------------------------------------------

@patch(
    "app.api.driver_route_execution.get_collection_proof_url"
)
def test_get_collection_proof_url_endpoint(
    proof_url_mock,
):
    proof_url_mock.return_value = {
        "stop_id": 501,
        "route_id": 10,
        "proof_uploaded": True,
        "expires_in": 3600,
        "signed_url": "https://example.com/proof.jpg",
    }

    response = client.get(
        "/api/driver/routes/10/stops/501/proof-url"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["stop_id"] == 501
    assert body["route_id"] == 10
    assert body["proof_uploaded"] is True
    assert body["expires_in"] == 3600
    assert body["signed_url"] == (
        "https://example.com/proof.jpg"
    )

    proof_url_mock.assert_called_once()

    kwargs = proof_url_mock.call_args.kwargs

    assert kwargs["route_id"] == 10
    assert kwargs["stop_id"] == 501
    assert kwargs["user"] is driver_user
    assert kwargs["db"] is not None


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_driver_route_execution_rejects_non_driver():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.post(
        "/api/driver/routes/10/start"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user