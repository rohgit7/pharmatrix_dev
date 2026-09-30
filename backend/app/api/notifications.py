from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import UserRole
from app.schemas.notification import NotificationResponse
from app.services.notification_service import mark_notification_read


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
    current_user=Depends(
        require_role(
            UserRole.ADMIN,
            UserRole.DRIVER,
            UserRole.CUSTOMER,
            UserRole.FACILITY,
        )
    ),
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
    current_user=Depends(
        require_role(
            UserRole.ADMIN,
            UserRole.DRIVER,
            UserRole.CUSTOMER,
            UserRole.FACILITY,
        )
    ),
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