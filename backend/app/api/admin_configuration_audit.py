from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.configuration_audit import ConfigurationAudit
from app.models.user import User, UserRole


router = APIRouter(
    prefix="/api/admin/configuration/audit",
    tags=["Admin Configuration Audit"],
)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:

    if current_user.role != UserRole.ADMIN:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


@router.get("")
def list_configuration_audits(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):

    return db.scalars(
        select(ConfigurationAudit)
        .order_by(
            ConfigurationAudit.created_at.desc()
        )
    ).all()