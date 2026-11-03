from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import hashlib
import json
import uuid

import pytest
from fastapi import HTTPException

from app.models.enums import (
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)
from app.services.route_execution_service import (
    arrive_at_stop,
    complete_stop,
)
from app.services.pickup_verification_driver_service import (
    verify_otp,
    verify_qr,
)
from app.services.collection_proof_service import (
    upload_collection_proof_base64,
)


# ---------------------------------------------------------------------------
# Test Fixtures & Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_driver_and_user():
    user = SimpleNamespace(id=10, role=UserRole.DRIVER)
    driver = SimpleNamespace(id=1, user_id=10, is_available=True)
    return user, driver


def create_mock_pickup(
    *,
    pickup_code="PKP-2026-0001",
    public_id=None,
    verification_token="secret_token_123",
    qr_verified_at=None,
    otp_verified_at=None,
    otp_hash=None,
    otp_expires_at=None,
    otp_attempts=0,
):
    pid = public_id or uuid.uuid4()
    location = SimpleNamespace(
        id=55,
        name="Metro City Clinic",
        latitude=12.9716,
        longitude=77.5946,
        address="100 Brigade Road",
        city="Bengaluru",
        state="KA",
        postal_code="560001",
    )
    pickup = SimpleNamespace(
        id=101,
        public_id=pid,
        pickup_code=pickup_code,
        verification_token=verification_token,
        location=location,
        status=PickupStatus.SCHEDULED,
        estimated_weight_kg=12.5,
        qr_verified_at=qr_verified_at,
        otp_verified_at=otp_verified_at,
        otp_hash=otp_hash,
        otp_expires_at=otp_expires_at,
        otp_attempts=otp_attempts,
        otp_last_requested_at=None,
        collected_at=None,
        customer_id=1,
        customer=SimpleNamespace(display_name="Dr. Rao", phone="+919876543210"),
    )
    return pickup


def create_mock_stop(
    pickup=None,
    execution_status=RouteStopStatus.PENDING,
    proof_storage_path=None,
    sequence_number=1,
):
    stop = SimpleNamespace(
        id=501,
        route_id=10,
        sequence_number=sequence_number,
        stop_type=RouteStopType.PICKUP,
        pickup=pickup,
        warehouse=None,
        execution_status=execution_status,
        arrived_at=None,
        completed_at=None,
        collected_weight_kg=None,
        proof_storage_path=proof_storage_path,
        proof_uploaded_at=None,
        failure_reason=None,
    )
    # Add properties
    stop.lat = pickup.location.latitude if pickup and pickup.location else None
    stop.lng = pickup.location.longitude if pickup and pickup.location else None
    stop.location_name = pickup.location.name if pickup and pickup.location else None
    return stop


# ---------------------------------------------------------------------------
# 1. GPS Geofence Verification Tests
# ---------------------------------------------------------------------------

def test_arrive_at_stop_within_geofence(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup()
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.PENDING)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ):
        # Driver is ~22m away from target (12.9718 vs 12.9716)
        result = arrive_at_stop(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            latitude=12.9718,
            longitude=77.5946,
            accuracy_meters=5.0,
            geofence_radius_meters=200.0,
        )

    assert result.execution_status == RouteStopStatus.ARRIVED
    assert result.arrived_at is not None
    mock_db.commit.assert_called_once()


def test_arrive_at_stop_outside_geofence_raises_error(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup()
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.PENDING)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ):
        # Driver is ~930m away (12.9800 vs 12.9716)
        with pytest.raises(HTTPException) as exc_info:
            arrive_at_stop(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                latitude=12.9800,
                longitude=77.5946,
                geofence_radius_meters=200.0,
            )

    assert exc_info.value.status_code == 400
    assert "Location verification failed" in exc_info.value.detail
    assert "exceeds the 200m geofence" in exc_info.value.detail


def test_arrive_at_stop_missing_driver_coords_raises_error(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup()
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.PENDING)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ):
        with pytest.raises(HTTPException) as exc_info:
            arrive_at_stop(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                latitude=None,
                longitude=None,
            )

    assert exc_info.value.status_code == 400
    assert "Driver GPS coordinates are required" in exc_info.value.detail


# ---------------------------------------------------------------------------
# 2. QR Code Verification Tests (JSON, Code, Public UUID)
# ---------------------------------------------------------------------------

def test_verify_qr_with_json_payload(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup(pickup_code="PKP-2026-0001")
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    qr_payload = json.dumps({
        "type": "PHARMATRIX_PICKUP",
        "pickup_code": "PKP-2026-0001",
        "pickup_id": str(pickup.public_id),
    })

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        res_stop, otp = verify_qr(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            qr_token=qr_payload,
        )

    assert res_stop.pickup.qr_verified_at is not None
    assert otp is not None
    assert len(otp) == 6
    assert res_stop.pickup.otp_hash is not None


def test_verify_qr_with_raw_pickup_code(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup(pickup_code="PKP-2026-0001")
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        res_stop, otp = verify_qr(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            qr_token="PKP-2026-0001",
        )

    assert res_stop.pickup.qr_verified_at is not None
    assert otp is not None


def test_verify_qr_with_public_id(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pub_id = uuid.uuid4()
    pickup = create_mock_pickup(public_id=pub_id)
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        res_stop, otp = verify_qr(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            qr_token=str(pub_id),
        )

    assert res_stop.pickup.qr_verified_at is not None
    assert otp is not None


def test_verify_qr_invalid_token_raises_403(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup(pickup_code="PKP-2026-0001")
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        with pytest.raises(HTTPException) as exc_info:
            verify_qr(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                qr_token="INVALID_QR_TOKEN_999",
            )

    assert exc_info.value.status_code == 403
    assert "Invalid pickup QR code" in exc_info.value.detail


# ---------------------------------------------------------------------------
# 3. Customer Handover OTP Verification Tests
# ---------------------------------------------------------------------------

def test_verify_otp_correct(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    raw_otp = "842109"
    otp_hash = hashlib.sha256(raw_otp.encode("utf-8")).hexdigest()

    pickup = create_mock_pickup(
        qr_verified_at=now,
        otp_hash=otp_hash,
        otp_expires_at=now + timedelta(minutes=15),
        otp_attempts=0,
    )
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        res_stop = verify_otp(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            otp=raw_otp,
        )

    assert res_stop.pickup.otp_verified_at is not None
    assert res_stop.execution_status == RouteStopStatus.IN_PROGRESS
    mock_db.commit.assert_called_once()


def test_verify_otp_incorrect_increments_attempts(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    correct_hash = hashlib.sha256(b"123456").hexdigest()

    pickup = create_mock_pickup(
        qr_verified_at=now,
        otp_hash=correct_hash,
        otp_expires_at=now + timedelta(minutes=15),
        otp_attempts=1,
    )
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                otp="999999",
            )

    assert exc_info.value.status_code == 400
    assert "Invalid OTP" in exc_info.value.detail
    assert pickup.otp_attempts == 2


def test_verify_otp_max_attempts_exceeded(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    correct_hash = hashlib.sha256(b"123456").hexdigest()

    pickup = create_mock_pickup(
        qr_verified_at=now,
        otp_hash=correct_hash,
        otp_expires_at=now + timedelta(minutes=15),
        otp_attempts=5,
    )
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                otp="123456",
            )

    assert exc_info.value.status_code == 429
    assert "Maximum OTP attempts exceeded" in exc_info.value.detail


def test_verify_otp_expired_raises_error(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    correct_hash = hashlib.sha256(b"123456").hexdigest()

    pickup = create_mock_pickup(
        qr_verified_at=now,
        otp_hash=correct_hash,
        otp_expires_at=now - timedelta(minutes=5),  # expired
        otp_attempts=0,
    )
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                otp="123456",
            )

    assert exc_info.value.status_code == 400
    assert "OTP has expired" in exc_info.value.detail


# ---------------------------------------------------------------------------
# 4. Strict Lifecycle Progression & Completion Tests
# ---------------------------------------------------------------------------

def test_complete_pickup_fails_without_qr_verification(mock_driver_and_user):
    user, driver = mock_driver_and_user
    pickup = create_mock_pickup(qr_verified_at=None)
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.ARRIVED)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.route_execution_service.get_active_version",
        return_value=SimpleNamespace(value="0.2"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            complete_stop(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                collected_weight_kg=12.5,
            )

    assert exc_info.value.status_code == 409
    assert "Pickup QR has not been verified" in exc_info.value.detail


def test_complete_pickup_fails_without_otp_verification(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    pickup = create_mock_pickup(qr_verified_at=now, otp_verified_at=None)
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.IN_PROGRESS)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.route_execution_service.get_active_version",
        return_value=SimpleNamespace(value="0.2"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            complete_stop(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                collected_weight_kg=12.5,
            )

    assert exc_info.value.status_code == 409
    assert "Customer OTP has not been verified" in exc_info.value.detail


def test_complete_pickup_fails_without_proof_upload(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    pickup = create_mock_pickup(qr_verified_at=now, otp_verified_at=now)
    stop = create_mock_stop(
        pickup=pickup,
        execution_status=RouteStopStatus.IN_PROGRESS,
        proof_storage_path=None,
    )
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.route_execution_service.get_active_version",
        return_value=SimpleNamespace(value="0.2"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            complete_stop(
                db=mock_db,
                user=user,
                route_id=10,
                stop_id=501,
                collected_weight_kg=12.5,
            )

    assert exc_info.value.status_code == 409
    assert "Collection proof has not been uploaded" in exc_info.value.detail


def test_complete_pickup_success_with_all_verifications(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    pickup = create_mock_pickup(qr_verified_at=now, otp_verified_at=now)
    stop = create_mock_stop(
        pickup=pickup,
        execution_status=RouteStopStatus.IN_PROGRESS,
        proof_storage_path="pickup-proofs/stop_501/proof.jpg",
    )
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.get.return_value = SimpleNamespace(
        id=1,
        user_id=100,
        phone="+919876543210",
        display_name="Dr. Rao",
    )

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.route_execution_service.get_active_version",
        return_value=SimpleNamespace(value="0.2"),
    ), patch(
        "app.services.route_execution_service.create_pickup_invoice",
        return_value=None,
    ), patch(
        "app.services.route_execution_service.notify_pickup_completed",
        return_value=None,
    ):
        res_stop = complete_stop(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            collected_weight_kg=12.5,
        )

    assert res_stop.execution_status == RouteStopStatus.COMPLETED
    assert res_stop.pickup.status == PickupStatus.COLLECTED
    assert res_stop.collected_weight_kg == 12.5
    assert res_stop.completed_at is not None
    mock_db.commit.assert_called_once()


def test_upload_collection_proof_base64_success(mock_driver_and_user):
    user, driver = mock_driver_and_user
    now = datetime.now(timezone.utc)
    pickup = create_mock_pickup(qr_verified_at=now, otp_verified_at=now)
    stop = create_mock_stop(pickup=pickup, execution_status=RouteStopStatus.IN_PROGRESS)
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = stop

    # Minimal valid 1x1 JPEG bytes
    jpeg_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\xFF\xC0\x00\x0B\x08\x00\x01\x00\x01\x01\x01\x11\x00\xFF\xC4\x00\x1F\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xFF\xDA\x00\x08\x01\x01\x00\x00?\x00\xBF\x00\xFF\xD9"
    import base64
    b64 = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")

    with patch(
        "app.services.collection_proof_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.collection_proof_service.get_supabase_admin",
    ) as mock_supabase:
        mock_storage = MagicMock()
        mock_supabase.return_value.storage.from_.return_value = mock_storage
        res_stop = upload_collection_proof_base64(
            db=mock_db,
            user=user,
            route_id=10,
            stop_id=501,
            image_base64=b64,
        )

    assert res_stop.proof_storage_path is not None
    assert res_stop.proof_uploaded_at is not None
    mock_storage.upload.assert_called_once()
    mock_db.commit.assert_called_once()

