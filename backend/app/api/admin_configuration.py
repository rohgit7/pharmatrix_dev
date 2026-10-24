from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.configuration import (
    ConfigurationCreate,
    ConfigurationDetailResponse,
    ConfigurationHistoryResponse,
    ConfigurationResponse,
    ConfigurationVersionResponse,
)
from app.services.configuration_service import (
    get_active_version,
    get_configuration_detail,
    get_configuration_history,
    list_configurations,
)


router = APIRouter(
    prefix="/api/admin/configuration",
    tags=["Admin Configuration"],
)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


@router.get(
    "",
    response_model=list[ConfigurationResponse],
)
def list_configuration_values(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return list_configurations(db)


@router.get(
    "/{key}",
    response_model=ConfigurationDetailResponse,
)
def get_configuration_value(
    key: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):

    result = get_configuration_detail(
        db,
        key,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found",
        )

    configuration, _ = result

    active_version = get_active_version(
        db,
        key,
    )

    return ConfigurationDetailResponse(
        id=configuration.id,
        key=configuration.key,
        description=configuration.description,
        data_type=configuration.data_type,
        scope=configuration.scope,
        scope_id=configuration.scope_id,
        current_version_id=(
            active_version.id
            if active_version
            else None
        ),
        is_active=configuration.is_active,
        created_at=configuration.created_at,
        updated_at=configuration.updated_at,
        current_version=(
            ConfigurationVersionResponse.model_validate(
                active_version
            )
            if active_version
            else None
        ),
    )


@router.get(
    "/{key}/history",
    response_model=ConfigurationHistoryResponse,
)
def get_configuration_version_history(
    key: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):

    result = get_configuration_history(
        db,
        key,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found",
        )

    configuration, versions = result

    return ConfigurationHistoryResponse(
        configuration=configuration,
        versions=versions,
    )


@router.post(
    "",
    response_model=ConfigurationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_configuration_param(
    data: ConfigurationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models.configuration import Configuration
    existing = db.query(Configuration).filter(Configuration.key == data.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Configuration key already exists",
        )

    config = Configuration(
        key=data.key,
        description=data.description,
        data_type=data.data_type,
        scope=data.scope,
        scope_id=data.scope_id,
        is_active=data.is_active,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.delete(
    "/{key}",
    status_code=status.HTTP_200_OK,
)
def delete_configuration_param(
    key: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models.configuration import Configuration
    config = db.query(Configuration).filter(Configuration.key == key).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found",
        )

    try:
        db.delete(config)
        db.commit()
    except Exception:
        db.rollback()
        config.is_active = False
        db.commit()

    return {"message": "Configuration parameter removed successfully"}