from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.configuration_change import (
    ConfigurationChange,
)
from app.models.user import User, UserRole
from app.schemas.configuration_change import (
    ConfigurationChangeCreate,
    ConfigurationChangeResponse,
    ConfigurationChangeReview,
    ConfigurationRollbackCreate,
)
from app.services.configuration_change_service import (
    approve_change_request,
    create_change_request,
    create_rollback_request,
    reject_change_request,
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


@router.post(
    "/change-request",
    response_model=ConfigurationChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_configuration_change(
    data: ConfigurationChangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    try:
        change = create_change_request(
            db,
            configuration_id=data.configuration_id,
            proposed_value=data.proposed_value,
            risk_level=data.risk_level,
            reason=data.reason,
            created_by=current_user.id,
            change_reference=data.change_reference,
            effective_from=data.effective_from,
        )

        db.commit()
        db.refresh(change)

        return change

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

@router.post(
    "/{configuration_id}/rollback",
    response_model=ConfigurationChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def rollback_configuration(
    configuration_id: int,
    data: ConfigurationRollbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    try:
        change = create_rollback_request(
            db,
            configuration_id=configuration_id,
            rollback_to_version_id=data.rollback_to_version_id,
            reason=data.reason,
            created_by=current_user.id,
            change_reference=data.change_reference,
            effective_from=data.effective_from,
        )

        db.commit()
        db.refresh(change)

        return change

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/change-requests",
    response_model=list[ConfigurationChangeResponse],
)
def list_configuration_changes(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):

    return db.scalars(
        select(ConfigurationChange)
        .order_by(
            ConfigurationChange.created_at.desc()
        )
    ).all()


@router.get(
    "/change-requests/{change_id}",
    response_model=ConfigurationChangeResponse,
)
def get_configuration_change(
    change_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):

    change = db.get(
        ConfigurationChange,
        change_id,
    )

    if not change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration change request not found",
        )

    return change


@router.post(
    "/change-requests/{change_id}/approve",
    response_model=ConfigurationChangeResponse,
)
def approve_configuration_change(
    change_id: int,
    data: ConfigurationChangeReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    try:
        approve_change_request(
            db,
            change_id=change_id,
            approver_id=current_user.id,
            comment=data.comment,
        )

        db.commit()

        change = db.get(
            ConfigurationChange,
            change_id,
        )

        return change

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/change-requests/{change_id}/reject",
    response_model=ConfigurationChangeResponse,
)
def reject_configuration_change(
    change_id: int,
    data: ConfigurationChangeReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    if not data.comment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection comment is required",
        )

    try:
        reject_change_request(
            db,
            change_id=change_id,
            approver_id=current_user.id,
            comment=data.comment,
        )

        db.commit()
        db.refresh(
            db.get(
                ConfigurationChange,
                change_id,
            )
        )

        return db.get(
            ConfigurationChange,
            change_id,
        )

    except ValueError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )