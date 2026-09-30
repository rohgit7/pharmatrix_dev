from app.models.enums import (
    NotificationChannel,
    NotificationType,
)
from app.services.notification_service import (
    create_notification,
)


def notify_pickup_requested(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Requested",
        body=f"Pickup {pickup_code} has been requested successfully.",
        event_key=f"PICKUP_REQUESTED:{pickup_id}",
        metadata={
            "pickup_id": pickup_id,
            "pickup_code": pickup_code,
        },
    )


def notify_pickup_scheduled(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
    scheduled_date,
):
    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_SCHEDULED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Scheduled",
        body=(
            f"Pickup {pickup_code} has been scheduled "
            f"for {scheduled_date}."
        ),
        event_key=f"PICKUP_SCHEDULED:{pickup_id}",
        metadata={
            "pickup_id": pickup_id,
            "pickup_code": pickup_code,
            "scheduled_date": str(scheduled_date),
        },
    )


def notify_driver_assigned(
    db,
    *,
    driver_user_id: int,
    route_id: int,
    route_code: str,
):
    return create_notification(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        channel=NotificationChannel.IN_APP,
        title="Route Assigned",
        body=f"Route {route_code} has been assigned to you.",
        event_key=f"DRIVER_ASSIGNED:{route_id}",
        metadata={
            "route_id": route_id,
            "route_code": route_code,
        },
    )


def notify_pickup_completed(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_COMPLETED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Completed",
        body=f"Pickup {pickup_code} has been completed.",
        event_key=f"PICKUP_COMPLETED:{pickup_id}",
        metadata={
            "pickup_id": pickup_id,
            "pickup_code": pickup_code,
        },
    )


def notify_shipment_dispatched(
    db,
    *,
    facility_user_id: int,
    shipment_id: int,
    shipment_code: str,
):
    return create_notification(
        db,
        user_id=facility_user_id,
        notification_type=NotificationType.SHIPMENT_DISPATCHED,
        channel=NotificationChannel.IN_APP,
        title="Shipment Dispatched",
        body=f"Disposal shipment {shipment_code} is in transit.",
        event_key=f"SHIPMENT_DISPATCHED:{shipment_id}",
        metadata={
            "shipment_id": shipment_id,
            "shipment_code": shipment_code,
        },
    )


def notify_shipment_received(
    db,
    *,
    customer_user_id: int,
    shipment_id: int,
    shipment_code: str,
):
    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.SHIPMENT_RECEIVED,
        channel=NotificationChannel.IN_APP,
        title="Shipment Received",
        body=f"Shipment {shipment_code} has been received at the disposal facility.",
        event_key=f"SHIPMENT_RECEIVED:{shipment_id}",
        metadata={
            "shipment_id": shipment_id,
            "shipment_code": shipment_code,
        },
    )


def notify_disposal_completed(
    db,
    *,
    customer_user_id: int,
    shipment_id: int,
    shipment_code: str,
):
    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DISPOSAL_COMPLETED,
        channel=NotificationChannel.IN_APP,
        title="Disposal Completed",
        body=(
            f"Disposal for shipment {shipment_code} "
            f"has been completed."
        ),
        event_key=f"DISPOSAL_COMPLETED:{shipment_id}",
        metadata={
            "shipment_id": shipment_id,
            "shipment_code": shipment_code,
        },
    )