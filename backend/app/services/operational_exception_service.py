from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import (
    OperationalExceptionStatus,
    OperationalExceptionType,
    NotificationChannel,
    NotificationType,
    UserRole,
)
from app.models.operational_exception import OperationalException
from app.models.user import User
from app.services.configuration_runtime_service import (
    get_configuration_float,
)
from app.services.notification_service import create_notification


def create_operational_exception(
    db: Session,
    *,
    exception_type: OperationalExceptionType,
    source_type: str,
    source_id: int,
    reason: str,
) -> OperationalException:
    existing = db.scalar(
        select(OperationalException)
        .where(
            OperationalException.exception_type == exception_type,
            OperationalException.source_type == source_type,
            OperationalException.source_id == source_id,
            OperationalException.status.in_(
                [
                    OperationalExceptionStatus.OPEN,
                    OperationalExceptionStatus.ESCALATED,
                ]
            ),
        )
        .order_by(OperationalException.id.desc())
    )

    if existing:
        return existing

    exception = OperationalException(
        exception_type=exception_type,
        status=OperationalExceptionStatus.OPEN,
        source_type=source_type,
        source_id=source_id,
        reason=reason,
        opened_at=datetime.now(timezone.utc),
    )

    db.add(exception)
    db.flush()

    return exception

def list_operational_exceptions(
    db: Session,
    *,
    status_filter: OperationalExceptionStatus | None = None,
    exception_type: OperationalExceptionType | None = None,
) -> list[OperationalException]:
    query = (
        select(OperationalException)
        .order_by(
            OperationalException.status,
            OperationalException.opened_at.desc(),
        )
    )

    if status_filter is not None:
        query = query.where(
            OperationalException.status == status_filter
        )

    if exception_type is not None:
        query = query.where(
            OperationalException.exception_type
            == exception_type
        )

    return db.scalars(query).all()


def get_operational_exception(
    db: Session,
    exception_id: int,
) -> OperationalException | None:
    return db.scalar(
        select(OperationalException).where(
            OperationalException.id == exception_id
        )
    )


def process_exception_escalations() -> int:
    from app.core.database import SessionLocal

    db = SessionLocal()

    escalated_count = 0

    try:
        escalation_minutes = get_configuration_float(
            db,
            "operations.exception_auto_escalation_minutes",
        )

        now = datetime.now(timezone.utc)

        escalation_cutoff = (
            now - timedelta(minutes=escalation_minutes)
        )

        exceptions = db.scalars(
            select(OperationalException)
            .where(
                OperationalException.status
                == OperationalExceptionStatus.OPEN,
                OperationalException.opened_at
                <= escalation_cutoff,
            )
            .with_for_update(skip_locked=True)
        ).all()

        if not exceptions:
            db.commit()
            return 0

        admin_users = db.scalars(
            select(User).where(
                User.role == UserRole.ADMIN
            )
        ).all()

        for exception in exceptions:
            exception.status = (
                OperationalExceptionStatus.ESCALATED
            )
            exception.escalated_at = now

            for admin in admin_users:
                create_notification(
                    db,
                    user_id=admin.id,
                    notification_type=(
                        NotificationType.EXCEPTION_ESCALATED
                    ),
                    channel=NotificationChannel.IN_APP,
                    title="Operational Exception Escalated",
                    body=(
                        f"{exception.exception_type.value} "
                        f"for {exception.source_type} "
                        f"{exception.source_id} "
                        f"has been escalated. "
                        f"Reason: {exception.reason}"
                    ),
                    event_key=(
                        f"EXCEPTION_ESCALATED:"
                        f"{exception.id}"
                    ),
                    metadata={
                        "exception_id": exception.id,
                        "exception_type": (
                            exception.exception_type.value
                        ),
                        "source_type": (
                            exception.source_type
                        ),
                        "source_id": exception.source_id,
                        "reason": exception.reason,
                    },
                )

            escalated_count += 1

        db.commit()

        return escalated_count

    finally:
        db.close()


def resolve_operational_exception(
    db: Session,
    *,
    exception_id: int,
    resolved_by_user_id: int,
    resolution_notes: str,
) -> OperationalException:
    exception = db.scalar(
        select(OperationalException)
        .where(
            OperationalException.id == exception_id
        )
        .with_for_update()
    )

    if not exception:
        raise ValueError(
            "Operational exception not found"
        )

    if exception.status == (
        OperationalExceptionStatus.RESOLVED
    ):
        raise ValueError(
            "Operational exception is already resolved"
        )

    resolved_by = db.get(
        User,
        resolved_by_user_id,
    )

    if not resolved_by:
        raise ValueError(
            "Resolving user not found"
        )

    if resolved_by.role != UserRole.ADMIN:
        raise ValueError(
            "Only administrators can resolve operational exceptions"
        )

    exception.status = (
        OperationalExceptionStatus.RESOLVED
    )
    exception.resolved_at = datetime.now(timezone.utc)
    exception.resolved_by_user_id = resolved_by_user_id
    exception.resolution_notes = resolution_notes

    db.flush()

    return exception