from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.models.configuration_change import ConfigurationChange
from app.services.configuration_audit_service import (
    record_configuration_audit,
)
from app.services.configuration_value_validator import (
    validate_configuration_constraints,
    validate_configuration_value,
)

def _ensure_no_future_scheduled_version(
    db: Session,
    configuration_id: int,
) -> None:
    now = datetime.now(timezone.utc)

    existing_scheduled = db.scalar(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.configuration_id
            == configuration_id,
            ConfigurationVersion.status == "SCHEDULED",
            ConfigurationVersion.effective_from.is_not(None),
            ConfigurationVersion.effective_from > now,
        )
        .order_by(
            ConfigurationVersion.effective_from.asc()
        )
    )

    if existing_scheduled:
        raise ValueError(
            "A future scheduled version already exists "
            f"for this configuration "
            f"(version {existing_scheduled.version}, "
            f"effective from "
            f"{existing_scheduled.effective_from})"
        )

def create_change_request(
    db: Session,
    *,
    configuration_id: int,
    proposed_value,
    risk_level: str,
    reason: str,
    created_by: int,
    change_reference: str | None = None,
    effective_from=None,
) -> ConfigurationChange:

    configuration = db.get(
        Configuration,
        configuration_id,
    )

    if not configuration:
        raise ValueError(
            "Configuration not found"
        )

    if not configuration.is_active:
        raise ValueError(
            "Configuration is inactive"
        )

    validated_value = validate_configuration_value(
        configuration.data_type,
        proposed_value,
    )

    current_version = None

    if configuration.current_version_id:
        current_version = db.get(
            ConfigurationVersion,
            configuration.current_version_id,
        )

    existing_pending = db.scalar(
        select(ConfigurationChange)
        .where(
            ConfigurationChange.configuration_id
            == configuration_id,
            ConfigurationChange.status
            == "PENDING_APPROVAL",
        )
    )

    if existing_pending:
        raise ValueError(
            "A pending change already exists for this configuration"
        )
    now = datetime.now(timezone.utc)

    if effective_from is not None:
        if effective_from.tzinfo is None:
            raise ValueError(
                "effective_from must include timezone information"
            )
    if effective_from is not None:
        if effective_from < now:
            raise ValueError(
                "effective_from cannot be in the past"
            )
    if effective_from is not None and effective_from > now:
        _ensure_no_future_scheduled_version(
            db,
            configuration_id,
        )

    validate_configuration_constraints(
        configuration.key,
        validated_value,
    )

    change = ConfigurationChange(
        configuration_id=configuration_id,
        base_version_id=(
            current_version.id
            if current_version
            else None
        ),
        proposed_value=proposed_value,
        status="PENDING_APPROVAL",
        risk_level=risk_level,
        reason=reason,
        change_reference=change_reference,
        effective_from=effective_from,
        created_by=created_by,
    )

    db.add(change)
    db.flush()
    record_configuration_audit(
        db,
        configuration_id=configuration.id,
        actor_id=created_by,
        action="CHANGE_REQUEST_CREATED",
        configuration_version_id=(
            current_version.id
            if current_version
            else None
        ),
        change_request_id=change.id,
        old_value=(
            current_version.value
            if current_version
            else None
        ),
        new_value=proposed_value,
        reason=reason,
        change_reference=change_reference,
    )

    return change


def approve_change_request(
    db: Session,
    *,
    change_id: int,
    approver_id: int,
    comment: str | None = None,
) -> ConfigurationVersion:

    change = db.scalar(
        select(ConfigurationChange)
        .where(
            ConfigurationChange.id == change_id
        )
        .with_for_update()
    )

    if not change:
        raise ValueError(
            "Configuration change request not found"
        )

    if change.status != "PENDING_APPROVAL":
        raise ValueError(
            "Only pending changes can be approved"
        )

    if change.created_by == approver_id:
        raise ValueError(
            "The maker cannot approve their own change"
        )

    configuration = db.scalar(
        select(Configuration)
        .where(
            Configuration.id
            == change.configuration_id
        )
        .with_for_update()
    )
    validated_value = validate_configuration_value(
        configuration.data_type,
        change.proposed_value,
    )
    validate_configuration_constraints(
        configuration.key,
        validated_value,
    )
    if not configuration:
        raise ValueError(
            "Configuration not found"
        )

    latest_version = db.scalar(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.configuration_id
            == configuration.id
        )
        .order_by(
            ConfigurationVersion.version.desc()
        )
        .with_for_update()
    )

    next_version_number = (
        latest_version.version + 1
        if latest_version
        else 1
    )

    now = datetime.now(timezone.utc)

    effective_from = (
        change.effective_from or now
    )

    is_future_effective = (
        effective_from > now
    )
    if is_future_effective:
        _ensure_no_future_scheduled_version(
            db,
            configuration.id,
        )
    new_version = ConfigurationVersion(
        configuration_id=configuration.id,
        version=next_version_number,
        value=validated_value,
        status=(
            "SCHEDULED"
            if is_future_effective
            else "ACTIVE"
        ),
        effective_from=effective_from,
        created_by=change.created_by,
        approved_by=approver_id,
        approved_at=now,
        reason=change.reason,
        change_reference=change.change_reference,
        previous_version_id=(
            latest_version.id
            if latest_version
            else None
        ),
        rollback_of_version_id=(
            change.rollback_of_version_id
        ),
    )

    db.add(new_version)
    db.flush()

    if not is_future_effective:

        if latest_version:
            latest_version.status = "EXPIRED"

        configuration.current_version_id = (
            new_version.id
        )

    change.status = "APPROVED"
    change.approved_by = approver_id
    change.review_comment = comment
    change.reviewed_at = now
    record_configuration_audit(
        db,
        configuration_id=configuration.id,
        configuration_version_id=new_version.id,
        change_request_id=change.id,
        actor_id=approver_id,
        action=(
            "CONFIGURATION_ROLLED_BACK"
            if change.rollback_of_version_id
            else "CHANGE_APPROVED"
        ),
        old_value=(
            latest_version.value
            if latest_version
            else None
        ),
        new_value=change.proposed_value,
        reason=change.reason,
        change_reference=change.change_reference,
    )
    db.flush()

    return new_version

def create_rollback_request(
    db: Session,
    *,
    configuration_id: int,
    rollback_to_version_id: int,
    reason: str,
    created_by: int,
    change_reference: str | None = None,
    effective_from=None,
) -> ConfigurationChange:

    configuration = db.scalar(
        select(Configuration)
        .where(
            Configuration.id == configuration_id
        )
    )

    if not configuration:
        raise ValueError(
            "Configuration not found"
        )

    if not configuration.is_active:
        raise ValueError(
            "Configuration is inactive"
        )

    target_version = db.scalar(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.id
            == rollback_to_version_id,
            ConfigurationVersion.configuration_id
            == configuration_id,
        )
    )

    if not target_version:
        raise ValueError(
            "Rollback target version not found"
        )
    
    validated_value = validate_configuration_value(
        configuration.data_type,
        target_version.value,
    )

    if (
        configuration.current_version_id
        == target_version.id
    ):
        raise ValueError(
            "Configuration is already using this version"
        )

    existing_pending = db.scalar(
        select(ConfigurationChange)
        .where(
            ConfigurationChange.configuration_id
            == configuration_id,
            ConfigurationChange.status
            == "PENDING_APPROVAL",
        )
    )

    if existing_pending:
        raise ValueError(
            "A pending change already exists for this configuration"
        )

    if effective_from is not None:
        if effective_from.tzinfo is None:
            raise ValueError(
                "effective_from must include timezone information"
            )

        if effective_from < datetime.now(timezone.utc):
            raise ValueError(
                "effective_from cannot be in the past"
            )

        _ensure_no_future_scheduled_version(
            db,
            configuration_id,
        )
    
    change = ConfigurationChange(
        configuration_id=configuration_id,
        base_version_id=configuration.current_version_id,
        rollback_of_version_id=target_version.id,
        proposed_value=validated_value,
        status="PENDING_APPROVAL",
        risk_level="HIGH",
        reason=reason,
        change_reference=change_reference,
        effective_from=effective_from,
        created_by=created_by,
    )

    db.add(change)
    db.flush()

    latest_version = None

    if configuration.current_version_id:
        latest_version = db.get(
            ConfigurationVersion,
            configuration.current_version_id,
        )

    record_configuration_audit(
        db,
        configuration_id=configuration.id,
        configuration_version_id=target_version.id,
        change_request_id=change.id,
        actor_id=created_by,
        action="CHANGE_REQUEST_CREATED",
        old_value=(
            latest_version.value
            if latest_version
            else None
        ),
        new_value=target_version.value,
        reason=reason,
        change_reference=change_reference,
    )

    return change

def reject_change_request(
    db: Session,
    *,
    change_id: int,
    approver_id: int,
    comment: str,
) -> ConfigurationChange:

    change = db.scalar(
        select(ConfigurationChange)
        .where(
            ConfigurationChange.id == change_id
        )
        .with_for_update()
    )

    if not change:
        raise ValueError(
            "Configuration change request not found"
        )

    if change.status != "PENDING_APPROVAL":
        raise ValueError(
            "Only pending changes can be rejected"
        )

    if change.created_by == approver_id:
        raise ValueError(
            "The maker cannot reject their own change"
        )

    now = datetime.now(timezone.utc)

    change.status = "REJECTED"
    change.rejected_by = approver_id
    change.review_comment = comment
    change.reviewed_at = now
    record_configuration_audit(
        db,
        configuration_id=change.configuration_id,
        change_request_id=change.id,
        actor_id=approver_id,
        action="CHANGE_REJECTED",
        new_value=change.proposed_value,
        reason=comment,
        change_reference=change.change_reference,
    )
    db.flush()

    return change