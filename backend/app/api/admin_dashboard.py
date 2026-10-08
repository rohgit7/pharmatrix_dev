from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.admin_dashboard import AdminDashboardSummary
from app.services.admin_dashboard_service import (
    get_admin_dashboard_summary,
)

router = APIRouter(
    prefix="/api/admin/dashboard",
    tags=["Admin - Dashboard"],
    dependencies=[
        Depends(require_role(UserRole.ADMIN))
    ],
)


@router.get(
    "/summary",
    response_model=AdminDashboardSummary,
)
def dashboard_summary(
    db: Session = Depends(get_db),
):
    return get_admin_dashboard_summary(db)