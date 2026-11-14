from datetime import datetime, timedelta, timezone
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.audit_log import AuditLog
from app.models.device_token import DeviceToken
from app.models.enums import PickupStatus
from app.models.pickup import Pickup

logger = logging.getLogger("pharmatrix.retention")


def cleanup_expired_device_tokens(
    db: Session, max_inactive_days: int = 180
) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_inactive_days)
    count = (
        db.query(DeviceToken)
        .filter(
            or_(
                DeviceToken.is_active == False,
                DeviceToken.updated_at < cutoff,
            )
        )
        .delete(synchronize_session=False)
    )
    if count > 0:
        logger.info("Purged %d inactive/expired device push tokens", count)
    return count


def cleanup_expired_otp_metadata(
    db: Session, max_age_days: int = 30
) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    expired_pickups = (
        db.query(Pickup)
        .filter(
            Pickup.status.in_([PickupStatus.COLLECTED, PickupStatus.CANCELLED, PickupStatus.FAILED]),
            Pickup.updated_at < cutoff,
            Pickup.otp_hash.isnot(None),
        )
        .all()
    )
    count = 0
    for p in expired_pickups:
        p.otp_hash = None
        p.otp_expires_at = None
        count += 1
    if count > 0:
        logger.info("Purged OTP verification hashes from %d historical completed pickups", count)
    return count


def run_retention_maintenance(db: Session) -> dict[str, int]:
    try:
        tokens_purged = cleanup_expired_device_tokens(db)
        otps_cleared = cleanup_expired_otp_metadata(db)
        db.commit()

        if tokens_purged > 0 or otps_cleared > 0:
            audit = AuditLog(
                entity_type="SYSTEM",
                entity_id="RETENTION_CRON",
                action="DATA_RETENTION_CLEANUP",
                actor_id=None,
                actor_email="system@pharmatrix.internal",
                new_values={
                    "tokens_purged": tokens_purged,
                    "otps_cleared": otps_cleared,
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                },
                notes="Automated data retention maintenance cycle executed.",
            )
            db.add(audit)
            db.commit()

        return {
            "tokens_purged": tokens_purged,
            "otps_cleared": otps_cleared,
        }
    except Exception as exc:
        db.rollback()
        logger.exception("Error executing retention maintenance: %s", exc)
        return {"error": str(exc)}

