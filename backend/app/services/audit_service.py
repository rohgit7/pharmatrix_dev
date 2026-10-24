from __future__ import annotations

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def log_operational_audit(
    db: Session,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    entity_code: str | None = None,
    actor_id: int | None = None,
    actor_name: str | None = None,
    actor_email: str | None = None,
    details: dict | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    notes: str | None = None,
    **kwargs,
) -> AuditLog | None:
    """
    Records an immutable operational audit log entry for system actions,
    lifecycle changes, approvals, reruns, and recovery procedures.
    """
    # Accommodate legacy positional calls where entity_type was 2nd and action was 4th
    action_val = action or kwargs.get("action", "UNKNOWN")
    entity_type_val = entity_type or kwargs.get("entity_type", "SYSTEM")
    entity_id_val = entity_id if entity_id is not None else kwargs.get("entity_id", 0)

    merged_new_values = dict(new_values or {})
    if details:
        merged_new_values.update(details)
    if entity_code and "entity_code" not in merged_new_values:
        merged_new_values["entity_code"] = entity_code
    if actor_name and "actor_name" not in merged_new_values:
        merged_new_values["actor_name"] = actor_name

    try:
        audit_entry = AuditLog(
            entity_type=str(entity_type_val).upper(),
            entity_id=str(entity_id_val),
            action=str(action_val).upper(),
            actor_id=actor_id or kwargs.get("actor_id"),
            actor_email=actor_email or kwargs.get("actor_email"),
            old_values=old_values,
            new_values=merged_new_values,
            notes=notes or (f"Entity Code: {entity_code}" if entity_code else None),
            created_at=datetime.now(timezone.utc),
        )
        db.add(audit_entry)
        db.flush()
        return audit_entry
    except Exception as exc:
        logger.error(f"Failed to record operational audit log: {exc}", exc_info=True)
        # Avoid breaking primary transaction for audit logging failure
        return None
