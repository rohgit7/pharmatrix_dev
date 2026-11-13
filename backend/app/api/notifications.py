from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.device_token import DeviceToken
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.models.user import UserRole
from app.schemas.notification import (
    DeviceTokenDeactivateRequest,
    DeviceTokenRegisterRequest,
    DeviceTokenResponse,
    NotificationResponse,
    TestPushRequest,
)
from app.services.notification_service import (
    deactivate_device_token,
    get_active_device_tokens,
    mark_notification_read,
    register_device_token,
    send_push_notification_to_user,
)


auth_any_user = require_role(
    UserRole.ADMIN,
    UserRole.DRIVER,
    UserRole.CUSTOMER,
    UserRole.FACILITY,
)


router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)

@router.get(
    "/",
    response_model=list[NotificationResponse],
)
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    notifications = db.scalars(
        select(Notification)
        .where(
            Notification.user_id == current_user.id
        )
        .order_by(
            Notification.created_at.desc()
        )
    ).all()

    return notifications

@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    notification = db.scalar(
        select(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    mark_notification_read(
        db,
        notification,
    )

    db.commit()
    db.refresh(notification)

    return notification


@router.post(
    "/devices",
    response_model=DeviceTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_device(
    payload: DeviceTokenRegisterRequest,
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    """
    Register or reactivate an Expo device token for the authenticated user.
    """
    try:
        device = register_device_token(
            db=db,
            user_id=current_user.id,
            expo_push_token=payload.expo_push_token,
            device_platform=payload.device_platform,
            device_name=payload.device_name,
        )
        db.commit()
        db.refresh(device)
        return device
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/devices",
    response_model=list[DeviceTokenResponse],
)
def list_my_devices(
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    """
    List all active registered devices for the current user.
    """
    return get_active_device_tokens(db, current_user.id)


@router.post(
    "/deactivate-device",
    status_code=status.HTTP_200_OK,
)
def deactivate_device(
    payload: DeviceTokenDeactivateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    """
    Deactivate a device token upon logout.
    """
    success = deactivate_device_token(
        db=db,
        user_id=current_user.id,
        expo_push_token=payload.expo_push_token,
    )
    db.commit()
    return {"status": "success", "deactivated": success}


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_200_OK,
)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    device = db.scalar(
        select(DeviceToken).where(
            DeviceToken.id == device_id,
            DeviceToken.user_id == current_user.id,
        )
    )
    if not device:
        raise HTTPException(status_code=404, detail="Device token not found")

    device.is_active = False
    db.commit()
    return {"status": "success", "message": "Device deactivated"}


@router.post(
    "/test-push",
    status_code=status.HTTP_200_OK,
)
def test_push_notification(
    payload: TestPushRequest,
    db: Session = Depends(get_db),
    current_user=Depends(auth_any_user),
):
    """
    Send an immediate test push notification to all active devices of the current user.
    """
    deliveries = send_push_notification_to_user(
        db=db,
        user_id=current_user.id,
        notification_type=NotificationType.OPERATIONAL_ALERT,
        title=payload.title,
        body=payload.body,
        event_key=f"TEST_PUSH:{current_user.id}:{datetime.now().timestamp()}",
        channel_id="operational_alerts",
        metadata={"test": True, "user_id": current_user.id},
    )
    db.commit()
    return {
        "status": "success",
        "delivered_devices": deliveries,
        "message": f"Test notification dispatched to {deliveries} device(s).",
    }
