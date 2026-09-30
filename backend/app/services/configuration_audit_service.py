from sqlalchemy.orm import Session

from app.models.configuration_audit import ConfigurationAudit


def record_configuration_audit(
    db: Session,
    *,
    configuration_id: int,
    actor_id: int,
    action: str,
    configuration_version_id: int | None = None,
    change_request_id: int | None = None,
    old_value=None,
    new_value=None,
    reason: str | None = None,
    change_reference: str | None = None,
) -> ConfigurationAudit:

    audit = ConfigurationAudit(
        configuration_id=configuration_id,
        configuration_version_id=configuration_version_id,
        change_request_id=change_request_id,
        actor_id=actor_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        change_reference=change_reference,
    )

    db.add(audit)
    db.flush()

    return audit