from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.services.configuration_audit_service import (
    record_configuration_audit,
)


def activate_due_configuration_versions(
    db: Session,
) -> int:
    now = datetime.now(timezone.utc)

    versions = db.scalars(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.status == "SCHEDULED",
            ConfigurationVersion.effective_from <= now,
        )
        .order_by(
            ConfigurationVersion.effective_from.asc(),
            ConfigurationVersion.id.asc(),
        )
        .with_for_update(skip_locked=True)
    ).all()

    activated_count = 0

    for scheduled_version in versions:
        configuration = db.scalar(
            select(Configuration)
            .where(
                Configuration.id
                == scheduled_version.configuration_id
            )
            .with_for_update()
        )

        if not configuration or not configuration.is_active:
            continue

        previous_version = None

        if configuration.current_version_id:
            previous_version = db.get(
                ConfigurationVersion,
                configuration.current_version_id,
            )

        if previous_version and previous_version.id == scheduled_version.id:
            scheduled_version.status = "ACTIVE"
            activated_count += 1
            continue

        if previous_version:
            previous_version.status = "EXPIRED"
            previous_version.effective_until = now

        scheduled_version.status = "ACTIVE"
        configuration.current_version_id = scheduled_version.id

        record_configuration_audit(
            db,
            configuration_id=configuration.id,
            configuration_version_id=scheduled_version.id,
            actor_id=(
                scheduled_version.approved_by
                or scheduled_version.created_by
            ),
            action="CONFIGURATION_VERSION_ACTIVATED",
            old_value=(
                previous_version.value
                if previous_version
                else None
            ),
            new_value=scheduled_version.value,
            reason=scheduled_version.reason,
            change_reference=scheduled_version.change_reference,
        )

        activated_count += 1

    if activated_count:
        db.flush()

    return activated_count