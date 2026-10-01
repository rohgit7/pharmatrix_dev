from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.services.configuration_value_validator import (
    validate_configuration_value,
)

def list_configurations(
    db: Session,
) -> list[Configuration]:

    return db.scalars(
        select(Configuration)
        .where(
            Configuration.is_active.is_(True)
        )
        .order_by(
            Configuration.key
        )
    ).all()


def get_configuration_detail(
    db: Session,
    key: str,
) -> tuple[
    Configuration,
    ConfigurationVersion | None,
] | None:

    configuration = db.scalar(
        select(Configuration)
        .where(
            Configuration.key == key
        )
    )

    if not configuration:
        return None

    current_version = None

    if configuration.current_version_id:
        current_version = db.get(
            ConfigurationVersion,
            configuration.current_version_id,
        )

    return configuration, current_version


def get_configuration_history(
    db: Session,
    key: str,
) -> tuple[
    Configuration,
    list[ConfigurationVersion],
] | None:

    configuration = db.scalar(
        select(Configuration)
        .where(
            Configuration.key == key
        )
    )

    if not configuration:
        return None

    versions = db.scalars(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.configuration_id
            == configuration.id
        )
        .order_by(
            ConfigurationVersion.version.desc()
        )
    ).all()

    return configuration, versions


def get_configuration(
    db: Session,
    key: str,
) -> Configuration | None:

    return db.scalar(
        select(Configuration).where(
            Configuration.key == key
        )
    )


def get_active_version(
    db: Session,
    key: str,
) -> ConfigurationVersion | None:

    configuration = get_configuration(
        db,
        key,
    )

    if not configuration:
        return None

    now = datetime.now(timezone.utc)

    return db.scalar(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.configuration_id
            == configuration.id,
            ConfigurationVersion.status.in_(
                ["ACTIVE", "SCHEDULED"]
            ),
            ConfigurationVersion.effective_from <= now,
            (
                ConfigurationVersion.effective_until.is_(None)
                | (
                    ConfigurationVersion.effective_until
                    > now
                )
            ),
        )
        .order_by(
            ConfigurationVersion.effective_from.desc(),
            ConfigurationVersion.version.desc(),
        )
    )


def get_value(
    db: Session,
    key: str,
    default=None,
):
    version = get_active_version(
        db,
        key,
    )

    if not version:
        return default

    return version.value


def create_configuration(
    db: Session,
    *,
    key: str,
    value,
    data_type: str,
    created_by: int,
    description: str | None = None,
    scope: str = "GLOBAL",
    scope_id: int | None = None,
    reason: str | None = None,
    change_reference: str | None = None,
    effective_from: datetime | None = None,
) -> Configuration:

    existing = db.scalar(
        select(Configuration).where(
            Configuration.key == key
        )
    )

    if existing:
        raise ValueError(
            f"Configuration '{key}' already exists"
        )

    configuration = Configuration(
        key=key,
        description=description,
        data_type=data_type,
        scope=scope,
        scope_id=scope_id,
    )

    db.add(configuration)
    db.flush()

    validated_value = validate_configuration_value(
        data_type,
        value,
    )

    version = ConfigurationVersion(
        configuration_id=configuration.id,
        version=1,
        value=validated_value,
        status="ACTIVE",
        effective_from=(
            effective_from
            or datetime.now(timezone.utc)
        ),
        created_by=created_by,
        approved_by=created_by,
        approved_at=datetime.now(timezone.utc),
        reason=reason,
        change_reference=change_reference,
    )

    db.add(version)
    db.flush()

    configuration.current_version_id = version.id

    db.flush()

    return configuration


def create_next_version(
    db: Session,
    *,
    configuration: Configuration,
    value,
    created_by: int,
    reason: str | None = None,
    change_reference: str | None = None,
    effective_from: datetime | None = None,
) -> ConfigurationVersion:

    latest_version = db.scalar(
        select(ConfigurationVersion)
        .where(
            ConfigurationVersion.configuration_id
            == configuration.id
        )
        .order_by(
            ConfigurationVersion.version.desc()
        )
    )

    next_version = (
        latest_version.version + 1
        if latest_version
        else 1
    )

    version = ConfigurationVersion(
        configuration_id=configuration.id,
        version=next_version,
        value=value,
        status="ACTIVE",
        effective_from=(
            effective_from
            or datetime.now(timezone.utc)
        ),
        created_by=created_by,
        reason=reason,
        change_reference=change_reference,
        previous_version_id=(
            latest_version.id
            if latest_version
            else None
        ),
    )

    db.add(version)
    db.flush()

    if latest_version:
        latest_version.status = "EXPIRED"

    configuration.current_version_id = version.id

    db.flush()

    return version