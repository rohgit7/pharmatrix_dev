from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.compliance import (
    ConsentRecordRequest,
    ConsentRecordResponse,
    DataDeletionRequest,
    DataDeletionResponse,
    DataExportResponse,
    MarketingPreferencesResponse,
    MarketingPreferencesUpdate,
)
from app.services.compliance_service import (
    export_user_data,
    get_or_create_marketing_preferences,
    get_user_consents,
    process_data_deletion_request,
    record_user_consent,
    update_marketing_preferences,
)
from app.services.retention_service import run_retention_maintenance

router = APIRouter(
    prefix="/api/compliance",
    tags=["Compliance & Data Privacy"],
)

LEGAL_DIR = Path(__file__).resolve().parent.parent.parent.parent / "legal"


@router.get("/privacy-policy")
def get_privacy_policy():
    policy_path = LEGAL_DIR / "01_privacy_policy.md"
    if policy_path.exists():
        content = policy_path.read_text(encoding="utf-8")
        return {
            "version": "1.0.0",
            "effective_date": "2026-11-14",
            "jurisdiction": "India (DPDPA 2023 / IT Act 2000)",
            "document_name": "Pharmatrix Privacy Policy",
            "content_markdown": content,
        }
    return {
        "version": "1.0.0",
        "effective_date": "2026-11-14",
        "jurisdiction": "India (DPDPA 2023 / IT Act 2000)",
        "document_name": "Pharmatrix Privacy Policy",
        "content_markdown": "Pharmatrix Privacy Policy version 1.0.0 applies to all users.",
    }


@router.get("/terms")
def get_terms_and_conditions():
    terms_path = LEGAL_DIR / "02_terms_and_conditions.md"
    if terms_path.exists():
        content = terms_path.read_text(encoding="utf-8")
        return {
            "version": "1.0.0",
            "effective_date": "2026-11-14",
            "jurisdiction": "India",
            "document_name": "Pharmatrix Terms and Conditions",
            "content_markdown": content,
        }
    return {
        "version": "1.0.0",
        "effective_date": "2026-11-14",
        "jurisdiction": "India",
        "document_name": "Pharmatrix Terms and Conditions",
        "content_markdown": "Pharmatrix Terms and Conditions version 1.0.0 applies to all users.",
    }


@router.post("/consent", response_model=ConsentRecordResponse)
def record_consent(
    request: Request,
    data: ConsentRecordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return record_user_consent(
        db=db,
        user=current_user,
        data=data,
        ip_address=ip_addr,
        user_agent=user_agent,
    )


@router.get("/consent", response_model=list[ConsentRecordResponse])
def list_consents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_consents(db=db, user=current_user)


@router.get("/marketing-preferences", response_model=MarketingPreferencesResponse)
def get_marketing_prefs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_or_create_marketing_preferences(db=db, user=current_user)


@router.put("/marketing-preferences", response_model=MarketingPreferencesResponse)
def update_marketing_prefs(
    data: MarketingPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_marketing_preferences(db=db, user=current_user, data=data)


@router.get("/data-export", response_model=DataExportResponse)
@limiter.limit("2/minute")
def request_data_export(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return export_user_data(db=db, user=current_user)


@router.post("/data-deletion", response_model=DataDeletionResponse)
@limiter.limit("1/minute")
def request_data_deletion(
    request: Request,
    data: DataDeletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return process_data_deletion_request(
        db=db,
        user=current_user,
        data=data,
    )


@router.post("/admin/run-retention")
def trigger_retention_maintenance(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return run_retention_maintenance(db=db)

