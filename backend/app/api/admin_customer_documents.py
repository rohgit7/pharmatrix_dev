
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.storage import create_customer_document_signed_url
from app.models.customer_document import CustomerDocument
from app.models.user import User, UserRole


router = APIRouter(
    prefix="/api/admin/customer-documents",
    tags=["Admin Customer Documents"],
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


@router.get("/")
def list_customer_documents(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    documents = (
        db.query(CustomerDocument)
        .order_by(CustomerDocument.created_at.desc())
        .all()
    )

    return [
        {
            "id": document.id,
            "customer_id": document.customer_id,
            "document_type": document.document_type.value,
            "document_number": document.document_number,
            "is_verified": document.is_verified,
            "created_at": document.created_at,
        }
        for document in documents
    ]


@router.patch("/{document_id}/verification")
def set_document_verification(
    document_id: int,
    verified: bool,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    document = (
        db.query(CustomerDocument)
        .filter(CustomerDocument.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    document.is_verified = verified
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "is_verified": document.is_verified,
    }


@router.get("/{document_id}/download")
def admin_download_customer_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    document = (
        db.query(CustomerDocument)
        .filter(CustomerDocument.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    try:
        signed_url = create_customer_document_signed_url(
            document.document_url,
            expires_in=300,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate document download link",
        )

    return {"download_url": signed_url}
