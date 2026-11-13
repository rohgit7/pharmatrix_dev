import uuid
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import select

from app.models.device_token import DeviceToken
from app.models.enums import NotificationChannel, NotificationStatus, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.notifications.expo_push import is_valid_expo_push_token
from app.services.notification_events import (
    notify_customer_driver_assigned,
    notify_driver_approaching,
    notify_driver_arrived,
    notify_driver_assigned,
    notify_otp_generated,
    notify_payment_required,
    notify_payment_successful,
    notify_pickup_completed,
    notify_pickup_requested,
    notify_pickup_scheduled,
    notify_weight_recorded,
)
from app.services.notification_service import (
    deactivate_device_token,
    get_active_device_tokens,
    register_device_token,
    send_push_notification_to_user,
)


@pytest.fixture
def db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.database import Base

    engine = create_engine("sqlite:///:memory:")
    # Create only tables required for push notification testing
    User.__table__.create(bind=engine)
    Notification.__table__.create(bind=engine)
    DeviceToken.__table__.create(bind=engine)

    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def make_user(db, role=UserRole.CUSTOMER):
    suffix = uuid.uuid4().hex
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Push Test {suffix}",
        email=f"push-{suffix}@test.local",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_is_valid_expo_push_token():
    assert is_valid_expo_push_token("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]") is True
    assert is_valid_expo_push_token("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]") is True
    assert is_valid_expo_push_token("ExponentPushToken[AbC123_-.+=]") is True
    assert is_valid_expo_push_token("InvalidToken") is False
    assert is_valid_expo_push_token("") is False
    assert is_valid_expo_push_token(None) is False


def test_register_and_deactivate_device_token(db):
    user = make_user(db)
    token = "ExponentPushToken[test-device-token-12345]"

    device = register_device_token(
        db,
        user_id=user.id,
        expo_push_token=token,
        device_platform="android",
        device_name="Pixel 7",
    )
    assert device.id is not None
    assert device.user_id == user.id
    assert device.expo_push_token == token
    assert device.device_platform == "android"
    assert device.is_active is True

    # Check active tokens
    active_tokens = get_active_device_tokens(db, user.id)
    assert len(active_tokens) == 1
    assert active_tokens[0].expo_push_token == token

    # Deactivate
    deactivated = deactivate_device_token(db, user_id=user.id, expo_push_token=token)
    assert deactivated is True

    active_tokens = get_active_device_tokens(db, user.id)
    assert len(active_tokens) == 0

    # Reactivate
    reactivated = register_device_token(
        db,
        user_id=user.id,
        expo_push_token=token,
        device_platform="android",
    )
    assert reactivated.id == device.id
    assert reactivated.is_active is True


def test_register_device_token_reassigns_from_previous_user(db):
    user1 = make_user(db)
    user2 = make_user(db)
    shared_token = "ExponentPushToken[device-shared-token-999]"

    device1 = register_device_token(
        db,
        user_id=user1.id,
        expo_push_token=shared_token,
        device_platform="ios",
    )
    assert device1.is_active is True

    # User 2 logs into the same physical phone
    device2 = register_device_token(
        db,
        user_id=user2.id,
        expo_push_token=shared_token,
        device_platform="ios",
    )
    assert device2.is_active is True

    db.refresh(device1)
    assert device1.is_active is False


@patch("app.services.notification_service.ExpoPushProvider.send")
def test_send_push_notification_to_user(mock_send, db):
    mock_send.return_value = "ticket-uuid-12345"
    user = make_user(db)
    token = "ExponentPushToken[valid-push-token-abc]"

    register_device_token(
        db,
        user_id=user.id,
        expo_push_token=token,
        device_platform="android",
    )

    deliveries = send_push_notification_to_user(
        db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        title="Pickup Requested",
        body="Your pickup has been placed.",
        event_key="TEST_PUSH_EVENT:1",
        channel_id="pickup_updates",
        metadata={"pickup_id": 1},
    )

    assert deliveries == 1
    assert mock_send.called

    # Verify PUSH notification record in DB
    push_notif = db.scalar(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.channel == NotificationChannel.PUSH,
        )
    )
    assert push_notif is not None
    assert push_notif.status == NotificationStatus.SENT
    assert push_notif.provider_message_id == "ticket-uuid-12345"

    # Verify IN_APP notification record in DB
    in_app_notif = db.scalar(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.channel == NotificationChannel.IN_APP,
        )
    )
    assert in_app_notif is not None


@patch("app.services.notification_service.ExpoPushProvider.send")
def test_send_push_deactivates_unregistered_token(mock_send, db):
    mock_send.side_effect = Exception("DeviceNotRegistered: The device is no longer registered")
    user = make_user(db)
    token = "ExponentPushToken[expired-token-xyz]"

    register_device_token(
        db,
        user_id=user.id,
        expo_push_token=token,
        device_platform="android",
    )

    deliveries = send_push_notification_to_user(
        db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        title="Pickup Test",
        body="Testing expired token.",
        event_key="EXPIRED_TOKEN_TEST:1",
    )

    assert deliveries == 0
    active_tokens = get_active_device_tokens(db, user.id)
    assert len(active_tokens) == 0


@patch("app.services.notification_service.ExpoPushProvider.send")
def test_customer_and_driver_notification_events(mock_send, db):
    mock_send.return_value = "ticket-999"
    cust_user = make_user(db, role=UserRole.CUSTOMER)
    driver_user = make_user(db, role=UserRole.DRIVER)

    register_device_token(
        db,
        user_id=cust_user.id,
        expo_push_token="ExponentPushToken[customer-phone-token]",
        device_platform="android",
    )
    register_device_token(
        db,
        user_id=driver_user.id,
        expo_push_token="ExponentPushToken[driver-phone-token]",
        device_platform="android",
    )

    # 1. Pickup requested
    n1 = notify_pickup_requested(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001")
    assert n1.notification_type == NotificationType.PICKUP_REQUESTED

    # 2. Pickup scheduled
    n2 = notify_pickup_scheduled(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001", scheduled_date="2026-11-12")
    assert n2.notification_type == NotificationType.PICKUP_SCHEDULED

    # 3. Driver assigned (Driver)
    n3_driver = notify_driver_assigned(db, driver_user_id=driver_user.id, route_id=10, route_code="RT-010")
    assert n3_driver.notification_type == NotificationType.DRIVER_ASSIGNED

    # 4. Driver assigned (Customer)
    n3_cust = notify_customer_driver_assigned(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001", driver_name="Rohan")
    assert n3_cust.notification_type == NotificationType.DRIVER_ASSIGNED

    # 5. Driver approaching
    n4 = notify_driver_approaching(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001")
    assert n4.notification_type == NotificationType.DRIVER_APPROACHING

    # 6. Driver arrived
    n5 = notify_driver_arrived(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001")
    assert n5.notification_type == NotificationType.DRIVER_ARRIVED

    # 7. Weight recorded
    n6 = notify_weight_recorded(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001", weight_kg=12.5)
    assert n6.notification_type == NotificationType.WEIGHT_RECORDED

    # 8. Payment required
    n7 = notify_payment_required(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001", amount=450.0)
    assert n7.notification_type == NotificationType.PAYMENT_REQUIRED

    # 9. Payment successful
    n8 = notify_payment_successful(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001", amount=450.0)
    assert n8.notification_type == NotificationType.PAYMENT_SUCCESSFUL

    # 10. OTP generated
    n9 = notify_otp_generated(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001")
    assert n9.notification_type == NotificationType.OTP_GENERATED

    # 11. Pickup completed
    n10 = notify_pickup_completed(db, customer_user_id=cust_user.id, pickup_id=1, pickup_code="PK-001")
    assert n10.notification_type == NotificationType.PICKUP_COMPLETED


def test_device_token_api_endpoints(db):
    from app.api.notifications import (
        deactivate_device,
        list_my_devices,
        register_device,
        test_push_notification,
    )
    from app.schemas.notification import (
        DeviceTokenDeactivateRequest,
        DeviceTokenRegisterRequest,
        TestPushRequest,
    )

    test_user = make_user(db, role=UserRole.CUSTOMER)

    # 1. Register device
    dev = register_device(
        payload=DeviceTokenRegisterRequest(
            expo_push_token="ExponentPushToken[api-test-token-777]",
            device_platform="android",
            device_name="Test Phone",
        ),
        db=db,
        current_user=test_user,
    )
    assert dev.expo_push_token == "ExponentPushToken[api-test-token-777]"
    assert dev.is_active is True

    # 2. List devices
    devices = list_my_devices(db=db, current_user=test_user)
    assert len(devices) == 1
    assert devices[0].id == dev.id

    # 3. Test push endpoint
    with patch("app.services.notification_service.ExpoPushProvider.send") as mock_send:
        mock_send.return_value = "ticket-test-api"
        res = test_push_notification(
            payload=TestPushRequest(title="Hello", body="World"),
            db=db,
            current_user=test_user,
        )
        assert res["status"] == "success"
        assert res["delivered_devices"] == 1

    # 4. Deactivate device
    deact_res = deactivate_device(
        payload=DeviceTokenDeactivateRequest(expo_push_token="ExponentPushToken[api-test-token-777]"),
        db=db,
        current_user=test_user,
    )
    assert deact_res["status"] == "success"
    assert deact_res["deactivated"] is True

    # 5. List devices after deactivation
    devices_after = list_my_devices(db=db, current_user=test_user)
    assert len(devices_after) == 0

