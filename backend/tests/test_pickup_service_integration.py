import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.configuration import Configuration
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.models.enums import (
    CustomerType,
    NotificationChannel,
    NotificationType,
    NotificationStatus,
    PickupPriority,
    PickupStatus,
    UserRole,
)
from app.models.notification import Notification
from app.models.pickup import Pickup
from app.models.user import User
from app.services.configuration_service import create_configuration
from app.services.pickup_service import (
    create_pickup,
    schedule_pickup,
    cancel_pickup,
    get_customer_pickup,
    list_customer_pickups,
    list_all_pickups,
    schedule_pickup,
    get_pickup_by_id,
)


def make_user(
    db,
    suffix,
    role=UserRole.CUSTOMER,
):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Pickup Test User {suffix}",
        email=f"pickup-{suffix}@test.local",
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_customer(db, user):
    customer = Customer(
        user_id=user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Pickup Test Pharmacy Pvt Ltd",
        display_name="Pickup Test Pharmacy",
        phone="9876543210",
        email=user.email,
        gst_number="29ABCDE1234F1Z5",
        is_active=True,
    )

    db.add(customer)
    db.flush()

    return customer


def make_location(
    db,
    customer,
    *,
    active=True,
    pickup_enabled=True,
):
    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{uuid.uuid4().hex[:10]}",
        name="Pickup Test Branch",
        address_line_1="123 Test Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        service_time_seconds=300,
        pickup_enabled=pickup_enabled,
        is_active=active,
    )

    db.add(location)
    db.flush()

    return location


def make_max_weight_configuration(
    db,
    user,
    value=50,
):
    key = "operations.max_pickup_weight_kg"

    create_configuration(
        db,
        key=key,
        value=value,
        data_type="INTEGER",
        created_by=user.id,
        reason="Pickup integration test",
    )

    db.commit()

    return key


def cleanup(
    db,
    *,
    pickup=None,
    notification=None,
    location=None,
    customer=None,
    configuration=None,
    user=None,
):
    if pickup is not None:
        db.delete(pickup)

    if notification is not None:
        db.delete(notification)

    if location is not None:
        db.delete(location)

    if customer is not None:
        db.delete(customer)

    if configuration is not None:
        versions = (
            db.query(ConfigurationVersion)
            .filter(
                ConfigurationVersion.configuration_id
                == configuration.id
            )
            .all()
        )

        for version in versions:
            db.delete(version)

        db.delete(configuration)

    if user is not None:
        db.delete(user)

    db.commit()


def test_create_pickup_persists_pickup_and_notification(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=12.5,
            notes="Integration pickup test",
        )

        assert pickup.id is not None
        assert pickup.customer_id == customer.id
        assert pickup.location_id == location.id
        assert pickup.status == PickupStatus.REQUESTED
        assert pickup.priority == PickupPriority.HIGH
        assert pickup.estimated_weight_kg == 12.5
        assert pickup.notes == "Integration pickup test"
        assert pickup.pickup_code.startswith("PK-")
        assert pickup.verification_token
        assert pickup.requested_date == requested_date

        saved_pickup = db.get(
            Pickup,
            pickup.id,
        )

        assert saved_pickup is not None

        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.channel
                == NotificationChannel.IN_APP,
                Notification.event_key
                == f"PICKUP_REQUESTED:{pickup.id}",
            )
            .first()
        )

        assert notification is not None
        assert (
            notification.notification_type
            == NotificationType.PICKUP_REQUESTED
        )
        assert notification.status.value == "PENDING"
        assert notification.title == "Pickup Requested"
        assert pickup.pickup_code in notification.body

        assert notification.notification_metadata == {
            "pickup_id": pickup.id,
            "pickup_code": pickup.pickup_code,
        }

    finally:
        cleanup(
            db,
            pickup=(
                pickup
                if "pickup" in locals()
                else None
            ),
            notification=(
                notification
                if "notification" in locals()
                else None
            ),
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )


def test_create_pickup_rejects_weight_above_configuration(
    db,
):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=10,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=location.id,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=12,
                notes=None,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Estimated pickup weight exceeds the "
            "configured maximum of 10.0 kg"
        )

        pickup_count = (
            db.query(Pickup)
            .filter(
                Pickup.customer_id == customer.id
            )
            .count()
        )

        assert pickup_count == 0

    finally:
        cleanup(
            db,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )


def test_create_pickup_rejects_inactive_location(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)

    location = make_location(
        db,
        customer,
        active=False,
        pickup_enabled=True,
    )

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=location.id,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=5,
                notes=None,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Customer location is inactive"
        )

    finally:
        cleanup(
            db,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )


def test_create_pickup_rejects_disabled_location(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)

    location = make_location(
        db,
        customer,
        active=True,
        pickup_enabled=False,
    )

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=location.id,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=5,
                notes=None,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Pickup is disabled for this location"
        )

    finally:
        cleanup(
            db,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )


def test_create_pickup_rejects_missing_configuration(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=location.id,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=5,
                notes=None,
            )

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == (
            "Maximum pickup weight configuration is not available"
        )

    finally:
        cleanup(
            db,
            location=location,
            customer=customer,
            user=user,
        )


def test_create_pickup_rejects_missing_customer_location(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"missing-location-{suffix}")
    customer = make_customer(db, user)

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=999999999,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=5,
                notes=None,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Customer location not found"

    finally:
        cleanup(
            db,
            customer=customer,
            user=user,
        )

def test_schedule_pickup_updates_status_and_creates_notification(
    db,
):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key =make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(Configuration.key == configuration_key)
        .first()
    )

    pickup = None
    scheduled_notification = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=10,
            notes="Schedule integration test",
        )

        scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=2)
        )

        scheduled = schedule_pickup(
            db=db,
            pickup_id=pickup.id,
            scheduled_date=scheduled_date,
        )

        assert scheduled.id == pickup.id
        assert scheduled.status == PickupStatus.SCHEDULED
        assert scheduled.scheduled_date == scheduled_date

        db.refresh(pickup)

        assert pickup.status == PickupStatus.SCHEDULED
        assert pickup.scheduled_date == scheduled_date

        scheduled_notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.channel
                == NotificationChannel.IN_APP,
                Notification.event_key
                == f"PICKUP_SCHEDULED:{pickup.id}",
            )
            .first()
        )

        assert scheduled_notification is not None
        assert (
            scheduled_notification.notification_type
            == NotificationType.PICKUP_SCHEDULED
        )
        assert scheduled_notification.status == (
            NotificationStatus.PENDING
        )
        assert scheduled_notification.title == (
            "Pickup Scheduled"
        )
        assert scheduled_notification.body == (
            f"Pickup {pickup.pickup_code} has been scheduled "
            f"for {scheduled_date}."
        )
        assert scheduled_notification.notification_metadata == {
            "pickup_id": pickup.id,
            "pickup_code": pickup.pickup_code,
            "scheduled_date": str(scheduled_date),
        }

    finally:
        cleanup(
            db,
            pickup=pickup,
            notification=scheduled_notification,
            configuration=configuration,
            location=location,
            customer=customer,
            user=user,
        )

def test_cancel_pickup_updates_status_and_reason(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=10,
            notes="Cancel integration test",
        )

        reason = "Customer requested cancellation"

        cancelled = cancel_pickup(
            db=db,
            pickup_id=pickup.id,
            reason=reason,
        )

        assert cancelled.id == pickup.id
        assert cancelled.status == PickupStatus.CANCELLED
        assert cancelled.failure_reason == reason

        db.refresh(pickup)

        assert pickup.status == PickupStatus.CANCELLED
        assert pickup.failure_reason == reason

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_list_customer_pickups_returns_customer_pickups(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup_one = None
    pickup_two = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup_one = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="First pickup",
        )

        pickup_two = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date + timedelta(days=1),
            priority=PickupPriority.HIGH,
            estimated_weight_kg=15,
            notes="Second pickup",
        )

        pickups = list_customer_pickups(
            db=db,
            current_user=user,
        )

        pickup_ids = [pickup.id for pickup in pickups]

        assert pickup_one.id in pickup_ids
        assert pickup_two.id in pickup_ids

        assert all(
            pickup.customer_id == customer.id
            for pickup in pickups
        )

    finally:
        cleanup(
            db,
            pickup=pickup_two,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_get_customer_pickup_returns_owned_pickup(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, suffix)
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Get pickup integration test",
        )

        result = get_customer_pickup(
            db=db,
            current_user=user,
            pickup_id=pickup.id,
        )

        assert result.id == pickup.id
        assert result.customer_id == customer.id
        assert result.location_id == location.id
        assert result.pickup_code == pickup.pickup_code
        assert result.status == PickupStatus.REQUESTED

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_get_customer_pickup_rejects_pickup_owned_by_another_customer(db):
    suffix = uuid.uuid4().hex

    owner_user = make_user(db, f"owner-{suffix}")
    owner_customer = make_customer(db, owner_user)
    owner_location = make_location(db, owner_customer)

    other_user = make_user(db, f"other-{suffix}")
    other_customer = make_customer(db, other_user)

    configuration_key = make_max_weight_configuration(
        db,
        owner_user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=owner_user,
            location_id=owner_location.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Ownership test",
        )

        with pytest.raises(HTTPException) as exc_info:
            get_customer_pickup(
                db=db,
                current_user=other_user,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Pickup not found"

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=owner_location,
            customer=owner_customer,
            configuration=configuration,
            user=owner_user,
        )

        cleanup(
            db,
            customer=other_customer,
            user=other_user,
        )
    
def test_list_all_pickups_returns_pickups_across_customers(db):
    suffix = uuid.uuid4().hex

    user_one = make_user(db, f"one-{suffix}")
    customer_one = make_customer(db, user_one)
    location_one = make_location(db, customer_one)

    user_two = make_user(db, f"two-{suffix}")
    customer_two = make_customer(db, user_two)
    location_two = make_location(db, customer_two)

    configuration_key = make_max_weight_configuration(
        db,
        user_one,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup_one = None
    pickup_two = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup_one = create_pickup(
            db=db,
            current_user=user_one,
            location_id=location_one.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="List all pickup one",
        )

        pickup_two = create_pickup(
            db=db,
            current_user=user_two,
            location_id=location_two.id,
            requested_date=requested_date,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=15,
            notes="List all pickup two",
        )

        result = list_all_pickups(db=db)

        result_ids = {pickup.id for pickup in result}

        assert pickup_one.id in result_ids
        assert pickup_two.id in result_ids

        result_pickup_one = next(
            pickup
            for pickup in result
            if pickup.id == pickup_one.id
        )

        result_pickup_two = next(
            pickup
            for pickup in result
            if pickup.id == pickup_two.id
        )

        assert result_pickup_one.customer.id == customer_one.id
        assert result_pickup_one.location.id == location_one.id

        assert result_pickup_two.customer.id == customer_two.id
        assert result_pickup_two.location.id == location_two.id

    finally:
        cleanup(
            db,
            pickup=pickup_one,
            location=location_one,
            customer=customer_one,
            configuration=configuration,
            user=user_one,
        )

        cleanup(
            db,
            pickup=pickup_two,
            location=location_two,
            customer=customer_two,
            user=user_two,
        )

def test_list_all_pickups_filters_by_status(db):
    suffix = uuid.uuid4().hex

    user_one = make_user(db, f"filter-one-{suffix}")
    customer_one = make_customer(db, user_one)
    location_one = make_location(db, customer_one)

    user_two = make_user(db, f"filter-two-{suffix}")
    customer_two = make_customer(db, user_two)
    location_two = make_location(db, customer_two)

    configuration_key = make_max_weight_configuration(
        db,
        user_one,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup_one = None
    pickup_two = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup_one = create_pickup(
            db=db,
            current_user=user_one,
            location_id=location_one.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Status filter requested",
        )

        pickup_two = create_pickup(
            db=db,
            current_user=user_two,
            location_id=location_two.id,
            requested_date=requested_date,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=15,
            notes="Status filter scheduled",
        )

        scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=2)
        )

        schedule_pickup(
            db=db,
            pickup_id=pickup_two.id,
            scheduled_date=scheduled_date,
        )

        requested_pickups = list_all_pickups(
            db=db,
            status_filter=PickupStatus.REQUESTED,
        )

        scheduled_pickups = list_all_pickups(
            db=db,
            status_filter=PickupStatus.SCHEDULED,
        )

        requested_ids = {
            pickup.id
            for pickup in requested_pickups
        }

        scheduled_ids = {
            pickup.id
            for pickup in scheduled_pickups
        }

        assert pickup_one.id in requested_ids
        assert pickup_two.id not in requested_ids

        assert pickup_two.id in scheduled_ids
        assert pickup_one.id not in scheduled_ids

        assert all(
            pickup.status == PickupStatus.REQUESTED
            for pickup in requested_pickups
        )

        assert all(
            pickup.status == PickupStatus.SCHEDULED
            for pickup in scheduled_pickups
        )

    finally:
        cleanup(
            db,
            pickup=pickup_one,
            location=location_one,
            customer=customer_one,
            configuration=configuration,
            user=user_one,
        )

        cleanup(
            db,
            pickup=pickup_two,
            location=location_two,
            customer=customer_two,
            user=user_two,
        )
    
def test_get_pickup_by_id_returns_pickup_with_relationships(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"get-by-id-{suffix}")
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Get pickup by ID test",
        )

        result = get_pickup_by_id(
            db=db,
            pickup_id=pickup.id,
        )

        assert result.id == pickup.id
        assert result.customer_id == customer.id
        assert result.location_id == location.id

        assert result.customer is not None
        assert result.customer.id == customer.id

        assert result.location is not None
        assert result.location.id == location.id

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_get_pickup_by_id_rejects_missing_pickup(db):
    missing_pickup_id = 999999

    with pytest.raises(HTTPException) as exc_info:
        get_pickup_by_id(
            db=db,
            pickup_id=missing_pickup_id,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Pickup not found"

def test_schedule_pickup_rejects_missing_pickup(db):
    missing_pickup_id = 999999

    scheduled_date = (
        datetime.now(timezone.utc)
        + timedelta(days=2)
    )

    with pytest.raises(HTTPException) as exc_info:
        schedule_pickup(
            db=db,
            pickup_id=missing_pickup_id,
            scheduled_date=scheduled_date,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Pickup not found"

def test_schedule_pickup_rejects_already_scheduled_pickup(db):
    suffix = uuid.uuid4().hex

    user = make_user(
        db,
        f"already-scheduled-{suffix}",
    )
    customer = make_customer(
        db,
        user,
    )
    location = make_location(
        db,
        customer,
    )

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None
    scheduled_notification = None

    try:
        requested_date = (
            datetime.now(timezone.utc)
            + timedelta(days=1)
        )

        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=requested_date,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Already scheduled test",
        )

        first_scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=2)
        )

        scheduled = schedule_pickup(
            db=db,
            pickup_id=pickup.id,
            scheduled_date=first_scheduled_date,
        )

        assert scheduled.status == PickupStatus.SCHEDULED
        assert scheduled.scheduled_date == first_scheduled_date

        scheduled_notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.channel
                == NotificationChannel.IN_APP,
                Notification.event_key
                == f"PICKUP_SCHEDULED:{pickup.id}",
            )
            .first()
        )

        assert scheduled_notification is not None

        second_scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=3)
        )

        with pytest.raises(HTTPException) as exc_info:
            schedule_pickup(
                db=db,
                pickup_id=pickup.id,
                scheduled_date=second_scheduled_date,
            )

        assert exc_info.value.status_code == 400
        assert (
            exc_info.value.detail
            == "Pickup cannot be scheduled from status SCHEDULED"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.SCHEDULED
        assert pickup.scheduled_date == first_scheduled_date

    finally:
        cleanup(
            db,
            pickup=pickup,
            notification=scheduled_notification,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_cancel_pickup_rejects_missing_pickup(db):
    missing_pickup_id = 999999

    with pytest.raises(HTTPException) as exc_info:
        cancel_pickup(
            db=db,
            pickup_id=missing_pickup_id,
            reason="Test cancellation",
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Pickup not found"

def test_cancel_pickup_rejects_already_cancelled_pickup(db):
    suffix = uuid.uuid4().hex

    user = make_user(
        db,
        f"already-cancelled-{suffix}",
    )
    customer = make_customer(
        db,
        user,
    )
    location = make_location(
        db,
        customer,
    )

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None

    try:
        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=(
                datetime.now(timezone.utc)
                + timedelta(days=1)
            ),
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Already cancelled test",
        )

        cancelled = cancel_pickup(
            db=db,
            pickup_id=pickup.id,
            reason="First cancellation",
        )

        assert cancelled.status == PickupStatus.CANCELLED
        assert cancelled.failure_reason == "First cancellation"

        with pytest.raises(HTTPException) as exc_info:
            cancel_pickup(
                db=db,
                pickup_id=pickup.id,
                reason="Second cancellation",
            )

        assert exc_info.value.status_code == 400
        assert (
            exc_info.value.detail
            == "Pickup cannot be cancelled from status CANCELLED"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.CANCELLED
        assert pickup.failure_reason == "First cancellation"

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_cancel_scheduled_pickup_updates_status_and_reason(db):
    suffix = uuid.uuid4().hex

    user = make_user(
        db,
        f"cancel-scheduled-{suffix}",
    )
    customer = make_customer(
        db,
        user,
    )
    location = make_location(
        db,
        customer,
    )

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(
            Configuration.key == configuration_key
        )
        .first()
    )

    pickup = None
    scheduled_notification = None

    try:
        pickup = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=(
                datetime.now(timezone.utc)
                + timedelta(days=1)
            ),
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=10,
            notes="Cancel scheduled test",
        )

        scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=2)
        )

        scheduled = schedule_pickup(
            db=db,
            pickup_id=pickup.id,
            scheduled_date=scheduled_date,
        )

        assert scheduled.status == PickupStatus.SCHEDULED

        scheduled_notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.channel
                == NotificationChannel.IN_APP,
                Notification.event_key
                == f"PICKUP_SCHEDULED:{pickup.id}",
            )
            .first()
        )

        assert scheduled_notification is not None

        cancelled = cancel_pickup(
            db=db,
            pickup_id=pickup.id,
            reason="Customer requested cancellation",
        )

        assert cancelled.id == pickup.id
        assert cancelled.status == PickupStatus.CANCELLED
        assert (
            cancelled.failure_reason
            == "Customer requested cancellation"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.CANCELLED
        assert (
            pickup.failure_reason
            == "Customer requested cancellation"
        )

    finally:
        cleanup(
            db,
            pickup=pickup,
            notification=scheduled_notification,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_create_pickup_rejects_inactive_customer(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"inactive-customer-{suffix}")
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(Configuration.key == configuration_key)
        .first()
    )

    try:
        customer.is_active = False
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            create_pickup(
                db=db,
                current_user=user,
                location_id=location.id,
                requested_date=None,
                priority=PickupPriority.NORMAL,
                estimated_weight_kg=5,
                notes=None,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Customer account is inactive"

    finally:
        cleanup(
            db,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_list_customer_pickups_rejects_inactive_customer(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"list-inactive-{suffix}")
    customer = make_customer(db, user)

    try:
        customer.is_active = False
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            list_customer_pickups(
                db=db,
                current_user=user,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Customer account is inactive"

    finally:
        cleanup(
            db,
            customer=customer,
            user=user,
        )

def test_get_customer_pickup_rejects_missing_pickup(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"missing-pickup-{suffix}")
    customer = make_customer(db, user)

    try:
        with pytest.raises(HTTPException) as exc_info:
            get_customer_pickup(
                db=db,
                current_user=user,
                pickup_id=999999999,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Pickup not found"

    finally:
        cleanup(
            db,
            customer=customer,
            user=user,
        )

def test_list_customer_pickups_returns_newest_first(db):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"ordering-{suffix}")
    customer = make_customer(db, user)
    location = make_location(db, customer)

    configuration_key = make_max_weight_configuration(
        db,
        user,
        value=50,
    )

    configuration = (
        db.query(Configuration)
        .filter(Configuration.key == configuration_key)
        .first()
    )

    pickup_older = None
    pickup_newer = None

    try:
        pickup_older = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=None,
            priority=PickupPriority.NORMAL,
            estimated_weight_kg=5,
            notes="Older pickup",
        )

        pickup_newer = create_pickup(
            db=db,
            current_user=user,
            location_id=location.id,
            requested_date=None,
            priority=PickupPriority.HIGH,
            estimated_weight_kg=10,
            notes="Newer pickup",
        )

        older_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        newer_time = datetime.now(timezone.utc)

        pickup_older.created_at = older_time
        pickup_newer.created_at = newer_time
        db.commit()

        pickups = list_customer_pickups(
            db=db,
            current_user=user,
        )

        assert len(pickups) == 2
        assert pickups[0].id == pickup_newer.id
        assert pickups[1].id == pickup_older.id

    finally:
        if pickup_older is not None:
            db.delete(pickup_older)

        if pickup_newer is not None:
            db.delete(pickup_newer)

        db.flush()

        cleanup(
            db,
            location=location,
            customer=customer,
            configuration=configuration,
            user=user,
        )

def test_list_customer_pickups_returns_empty_list_when_customer_has_no_pickups(
    db,
):
    suffix = uuid.uuid4().hex

    user = make_user(db, f"empty-list-{suffix}")
    customer = make_customer(db, user)

    try:
        pickups = list_customer_pickups(
            db=db,
            current_user=user,
        )

        assert pickups == []

    finally:
        cleanup(
            db,
            customer=customer,
            user=user,
        )

def test_list_customer_pickups_returns_empty_list_when_no_pickups(
    db,
):
    user = customer = None

    try:
        user = make_user(db, "no-pickups")
        customer = make_customer(db, user)

        pickups = list_customer_pickups(db, user)

        assert pickups == []

    finally:
        cleanup(
            db,
            customer=customer,
            user=user,
        )

def test_get_customer_pickup_returns_owned_pickup(
    db,
):
    user = customer = location = pickup = None

    try:
        user = make_user(db, "get-owned")
        customer = make_customer(db, user)
        location = make_location(db, customer)

        pickup = Pickup(
            pickup_code=f"PK-{uuid.uuid4().hex[:10].upper()}",
            verification_token=uuid.uuid4().hex,
            customer_id=customer.id,
            location_id=location.id,
            status=PickupStatus.REQUESTED,
            priority=PickupPriority.NORMAL,
            requested_date=datetime.now(timezone.utc).date(),
            estimated_weight_kg=10,
        )

        db.add(pickup)
        db.commit()
        db.refresh(pickup)

        result = get_customer_pickup(
            db,
            user,
            pickup.id,
        )

        assert result.id == pickup.id
        assert result.customer_id == customer.id
        assert result.location_id == location.id

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )

def test_list_all_pickups_returns_empty_list_when_no_pickups(db):
    pickups = list_all_pickups(db)

    assert pickups == []

def test_get_pickup_by_id_loads_customer_and_location(db):
    user = customer = location = pickup = None

    try:
        user = make_user(db, "get-rel")
        customer = make_customer(db, user)
        location = make_location(db, customer)

        pickup = Pickup(
            pickup_code=f"PK-{uuid.uuid4().hex[:10].upper()}",
            verification_token=uuid.uuid4().hex,
            customer_id=customer.id,
            location_id=location.id,
            status=PickupStatus.REQUESTED,
            priority=PickupPriority.NORMAL,
            requested_date=datetime.now(timezone.utc).date(),
            estimated_weight_kg=10,
        )

        db.add(pickup)
        db.commit()
        db.refresh(pickup)

        result = get_pickup_by_id(db, pickup.id)

        assert result.id == pickup.id
        assert result.customer.id == customer.id
        assert result.location.id == location.id

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )

def test_schedule_pickup_rejects_cancelled_pickup(db):
    pickup = None
    user = customer = location = None

    try:
        user = make_user(db, "schedule-cancelled")
        customer = make_customer(db, user)
        location = make_location(db, customer)

        pickup = Pickup(
            pickup_code=f"PK-{uuid.uuid4().hex[:10].upper()}",
            verification_token=uuid.uuid4().hex,
            customer_id=customer.id,
            location_id=location.id,
            status=PickupStatus.CANCELLED,
            priority=PickupPriority.NORMAL,
            requested_date=datetime.now(timezone.utc).date(),
            estimated_weight_kg=10,
        )

        db.add(pickup)
        db.commit()
        db.refresh(pickup)

        with pytest.raises(HTTPException) as exc:
            schedule_pickup(
                db,
                pickup.id,
                datetime.now(timezone.utc).date(),
            )

        assert exc.value.status_code == 400
        assert "cannot be scheduled" in exc.value.detail

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )

def test_cancel_pickup_rejects_completed_pickup(db):
    pickup = None
    user = customer = location = None

    try:
        user = make_user(db, "cancel-completed")
        customer = make_customer(db, user)
        location = make_location(db, customer)

        pickup = Pickup(
            pickup_code=f"PK-{uuid.uuid4().hex[:10].upper()}",
            verification_token=uuid.uuid4().hex,
            customer_id=customer.id,
            location_id=location.id,
            status=PickupStatus.COLLECTED,
            priority=PickupPriority.NORMAL,
            requested_date=datetime.now(timezone.utc).date(),
            estimated_weight_kg=10,
        )

        db.add(pickup)
        db.commit()
        db.refresh(pickup)

        with pytest.raises(HTTPException) as exc:
            cancel_pickup(
                db,
                pickup.id,
                "Customer requested cancellation",
            )

        assert exc.value.status_code == 400
        assert "cannot be cancelled" in exc.value.detail

    finally:
        cleanup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )