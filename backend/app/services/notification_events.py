import logging
from app.models.enums import (
    NotificationChannel,
    NotificationType,
)
from app.services.notification_service import (
    create_notification,
    send_push_notification_to_user,
)

logger = logging.getLogger(__name__)


# =============================================================================
# CUSTOMER NOTIFICATIONS
# =============================================================================

def notify_pickup_requested(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    event_key = f"PICKUP_REQUESTED:{pickup_id}"
    title = "Pickup Requested"
    body = f"Pickup {pickup_code} has been requested successfully."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "pickup_details",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_pickup_scheduled(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
    scheduled_date,
):
    event_key = f"PICKUP_SCHEDULED:{pickup_id}"
    title = "Pickup Scheduled"
    body = f"Pickup {pickup_code} has been scheduled for {scheduled_date}."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "scheduled_date": str(scheduled_date),
        "screen": "pickup_details",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_SCHEDULED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_SCHEDULED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_customer_driver_assigned(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
    driver_name: str | None = None,
    vehicle_reg: str | None = None,
):
    event_key = f"CUSTOMER_DRIVER_ASSIGNED:{pickup_id}"
    title = "Driver Assigned"
    info = f" by {driver_name}" if driver_name else ""
    body = f"A driver has been assigned to your pickup {pickup_code}{info}."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "driver_name": driver_name,
        "vehicle_reg": vehicle_reg,
        "screen": "pickup_details",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_driver_approaching(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    event_key = f"DRIVER_APPROACHING:{pickup_id}"
    title = "Driver On The Way"
    body = f"The driver is heading to your facility for pickup {pickup_code}."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "pickup_details",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_APPROACHING,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_APPROACHING,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_driver_arrived(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    event_key = f"DRIVER_ARRIVED:{pickup_id}"
    title = "Driver Arrived"
    body = f"Your driver has arrived at your facility for pickup {pickup_code}."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "handover",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_ARRIVED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.DRIVER_ARRIVED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_weight_recorded(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
    weight_kg: float,
):
    event_key = f"WEIGHT_RECORDED:{pickup_id}:{weight_kg}"
    title = "Actual Weight Recorded"
    body = f"Collected weight of {weight_kg:.2f} kg recorded for pickup {pickup_code}."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "weight_kg": weight_kg,
        "screen": "pickup_details",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.WEIGHT_RECORDED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.WEIGHT_RECORDED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_payment_required(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
    amount: float,
    invoice_id: int | None = None,
):
    event_key = f"PAYMENT_REQUIRED:{pickup_id}:{amount}"
    title = "Payment Required"
    body = f"An invoice of ₹{amount:,.2f} is ready for pickup {pickup_code}. Please complete payment."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "invoice_id": invoice_id,
        "amount": amount,
        "screen": "payment",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PAYMENT_REQUIRED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="payments",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PAYMENT_REQUIRED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_payment_successful(
    db,
    *,
    customer_user_id: int,
    pickup_id: int | None,
    pickup_code: str | None,
    amount: float,
    payment_reference: str | None = None,
):
    ref_suffix = f":{payment_reference}" if payment_reference else ""
    event_key = f"PAYMENT_SUCCESSFUL:{pickup_id or 'GENERAL'}{ref_suffix}"
    title = "Payment Successful"
    code_str = f" for pickup {pickup_code}" if pickup_code else ""
    body = f"Payment of ₹{amount:,.2f}{code_str} was received successfully."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "amount": amount,
        "payment_reference": payment_reference,
        "screen": "pickup_details" if pickup_id else "home",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PAYMENT_SUCCESSFUL,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="payments",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PAYMENT_SUCCESSFUL,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_otp_generated(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    """
    Notifies customer that OTP is generated.
    Note: Under security rules, sensitive tokens are never transmitted in push alerts.
    The customer opens the app OTP screen to view and present their code.
    """
    event_key = f"OTP_GENERATED:{pickup_id}"
    title = "Verification OTP Ready"
    body = f"Your verification OTP for pickup {pickup_code} is ready. Tap to view your code."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "otp",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.OTP_GENERATED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.OTP_GENERATED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_pickup_completed(
    db,
    *,
    customer_user_id: int,
    pickup_id: int,
    pickup_code: str,
):
    event_key = f"PICKUP_COMPLETED:{pickup_id}"
    title = "Pickup Completed"
    body = f"Pickup {pickup_code} has been completed."
    metadata = {
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "completion",
    }

    send_push_notification_to_user(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_COMPLETED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=customer_user_id,
        notification_type=NotificationType.PICKUP_COMPLETED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


# =============================================================================
# DRIVER NOTIFICATIONS
# =============================================================================

def notify_driver_assigned(
    db,
    *,
    driver_user_id: int,
    route_id: int,
    route_code: str,
):
    event_key = f"DRIVER_ASSIGNED:{route_id}"
    title = "Route Assigned"
    body = f"Route {route_code} has been assigned to you."
    metadata = {
        "route_id": route_id,
        "route_code": route_code,
        "screen": "routes",
    }

    send_push_notification_to_user(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_driver_route_updated(
    db,
    *,
    driver_user_id: int,
    route_id: int,
    route_code: str,
    reason: str | None = None,
):
    event_key = f"DRIVER_ROUTE_UPDATED:{route_id}"
    title = "Route Updated"
    reason_str = f": {reason}" if reason else ""
    body = f"Route {route_code} has been updated{reason_str}."
    metadata = {
        "route_id": route_id,
        "route_code": route_code,
        "screen": "routes",
    }

    send_push_notification_to_user(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.ROUTE_UPDATED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.ROUTE_UPDATED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_driver_pickup_cancelled(
    db,
    *,
    driver_user_id: int,
    route_id: int,
    pickup_id: int,
    pickup_code: str,
):
    event_key = f"DRIVER_PICKUP_CANCELLED:{pickup_id}"
    title = "Pickup Cancelled"
    body = f"Pickup {pickup_code} on your route has been cancelled."
    metadata = {
        "route_id": route_id,
        "pickup_id": pickup_id,
        "pickup_code": pickup_code,
        "screen": "routes",
    }

    send_push_notification_to_user(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.PICKUP_CANCELLED,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="pickup_updates",
        metadata=metadata,
    )

    return create_notification(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.PICKUP_CANCELLED,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=metadata,
    )


def notify_driver_operational_announcement(
    db,
    *,
    driver_user_id: int,
    title: str,
    body: str,
    metadata: dict | None = None,
):
    import time
    event_key = f"DRIVER_OP_ANNOUNCEMENT:{driver_user_id}:{int(time.time())}"
    meta = dict(metadata or {})
    meta["screen"] = meta.get("screen", "operations")

    send_push_notification_to_user(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.OPERATIONAL_ALERT,
        title=title,
        body=body,
        event_key=event_key,
        channel_id="operational_alerts",
        metadata=meta,
    )

    return create_notification(
        db,
        user_id=driver_user_id,
        notification_type=NotificationType.OPERATIONAL_ALERT,
        channel=NotificationChannel.IN_APP,
        title=title,
        body=body,
        event_key=event_key,
        metadata=meta,
    )


# =============================================================================
# FACILITY NOTIFICATIONS (Preserved from existing codebase)
# =============================================================================

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
