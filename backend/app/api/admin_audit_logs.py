from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import UserRole


router = APIRouter(
    prefix="/api/admin/audit-logs",
    tags=["Admin - Audit Logs"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


class AuditLogItem(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    entity_code: str | None = None
    actor_id: int | None = None
    actor_name: str | None = None
    details: dict | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class AuditLogResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get(
    "/",
    response_model=AuditLogResponse,
    summary="List operational lifecycle audit trail entries",
)
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditLog.entity_id == entity_id)
    if actor_id is not None:
        query = query.filter(AuditLog.actor_id == actor_id)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    items = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size).all()

    return AuditLogResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
