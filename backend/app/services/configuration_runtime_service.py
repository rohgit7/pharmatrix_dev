from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuration import Configuration
from app.services.configuration_service import get_active_version


def get_configuration_value(
    db: Session,
    key: str,
) -> Any:
    """
    Return the currently effective value for a configuration key.

    Scheduled future versions are ignored until their effective_from time.
    """

    configuration = db.scalar(
        select(Configuration).where(
            Configuration.key == key,
            Configuration.is_active.is_(True),
        )
    )

    if configuration is None:
        raise ValueError(f"Configuration not found or inactive: {key}")

    version = get_active_version(
        db=db,
        key=key,
    )

    if version is None:
        raise ValueError(
            f"No effective configuration version found for: {key}"
        )

    return version.value

def get_configuration_float(
    db: Session,
    key: str,
) -> float:
    value = get_configuration_value(db, key)

    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Configuration '{key}' is not a valid number"
        ) from exc


def get_configuration_int(
    db: Session,
    key: str,
) -> int:
    value = get_configuration_value(db, key)

    if isinstance(value, bool):
        raise ValueError(
            f"Configuration '{key}' is not a valid integer"
        )

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Configuration '{key}' is not a valid integer"
        ) from exc


def get_configuration_bool(
    db: Session,
    key: str,
) -> bool:
    value = get_configuration_value(db, key)

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"true", "1", "yes"}:
            return True

        if normalized in {"false", "0", "no"}:
            return False

    raise ValueError(
        f"Configuration '{key}' is not a valid boolean"
    )