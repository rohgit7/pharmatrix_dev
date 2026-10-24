from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.enums import (
    OperationalExceptionStatus,
    OperationalExceptionType,
)
from app.models.user import UserRole
from app.schemas.operational_exception import (
    OperationalExceptionCreate,
    OperationalExceptionResolveRequest,
    OperationalExceptionResponse,
    OperationalExceptionUpdate,
)
from app.services.operational_exception_service import (
    get_operational_exception,
    list_operational_exceptions,
    resolve_operational_exception,
)


router = APIRouter(
    prefix="/api/admin/exceptions",
    tags=["Admin - Exceptions"],
    dependencies=[
        Depends(require_role(UserRole.ADMIN))
    ],
)


@router.get(
    "/",
    response_model=list[OperationalExceptionResponse],
)
def admin_list_exceptions(
    status: OperationalExceptionStatus | None = Query(
        default=None,
    ),
    exception_type: OperationalExceptionType | None = Query(
        default=None,
    ),
    db: Session = Depends(get_db),
):
    return list_operational_exceptions(
        db=db,
        status_filter=status,
        exception_type=exception_type,
    )


@router.get(
    "/{exception_id}",
    response_model=OperationalExceptionResponse,
)
def admin_get_exception(
    exception_id: int,
    db: Session = Depends(get_db),
):
    exception = get_operational_exception(
        db=db,
        exception_id=exception_id,
    )

    if not exception:
        raise HTTPException(
            status_code=404,
            detail="Operational exception not found",
        )

    return exception


@router.post(
    "/{exception_id}/resolve",
    response_model=OperationalExceptionResponse,
)
def admin_resolve_exception(
    exception_id: int,
    data: OperationalExceptionResolveRequest,
    current_user=Depends(
        require_role(UserRole.ADMIN)
    ),
    db: Session = Depends(get_db),
):
    try:
        exception = resolve_operational_exception(
            db=db,
            exception_id=exception_id,
            resolved_by_user_id=current_user.id,
            resolution_notes=data.resolution_notes,
        )

        db.commit()
        db.refresh(exception)

        return exception

    except ValueError as exc:
        db.rollback()

        message = str(exc)

        if message == "Operational exception not found":
            raise HTTPException(
                status_code=404,
                detail=message,
            )

        if message == "Operational exception is already resolved":
            raise HTTPException(
                status_code=409,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )


@router.post(
    "/",
    response_model=OperationalExceptionResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_exception(
    data: OperationalExceptionCreate,
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    from app.models.operational_exception import OperationalException
    exception = OperationalException(
        exception_type=data.exception_type,
        source_type=data.source_type,
        source_id=data.source_id,
        status=OperationalExceptionStatus.OPEN,
        reason=data.reason,
        opened_at=datetime.now(timezone.utc),
    )
    db.add(exception)
    db.commit()
    db.refresh(exception)
    return exception


@router.post(
    "/{exception_id}/escalate",
    response_model=OperationalExceptionResponse,
)
def admin_escalate_exception(
    exception_id: int,
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    from app.models.operational_exception import OperationalException
    exception = db.query(OperationalException).filter(OperationalException.id == exception_id).first()
    if not exception:
        raise HTTPException(
            status_code=404,
            detail="Operational exception not found",
        )
    exception.status = OperationalExceptionStatus.ESCALATED
    exception.escalated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exception)
    return exception


@router.patch(
    "/{exception_id}",
    response_model=OperationalExceptionResponse,
)
def admin_update_exception(
    exception_id: int,
    data: OperationalExceptionUpdate,
    db: Session = Depends(get_db),
):
    from app.models.operational_exception import OperationalException
    exception = db.query(OperationalException).filter(OperationalException.id == exception_id).first()
    if not exception:
        raise HTTPException(
            status_code=404,
            detail="Operational exception not found",
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(exception, field, value)

    db.commit()
    db.refresh(exception)
    return exception


@router.delete(
    "/{exception_id}",
    status_code=status.HTTP_200_OK,
)
def admin_delete_exception(
    exception_id: int,
    db: Session = Depends(get_db),
):
    from app.models.operational_exception import OperationalException
    exception = db.query(OperationalException).filter(OperationalException.id == exception_id).first()
    if not exception:
        raise HTTPException(
            status_code=404,
            detail="Operational exception not found",
        )

    db.delete(exception)
    db.commit()
    return {"message": "Operational exception removed successfully"}