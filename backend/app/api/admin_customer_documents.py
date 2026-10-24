
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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


@router.post("/")
def admin_upload_customer_document(
    customer_id: int = Form(...),
    document_type: str = Form(...),
    document_number: str | None = Form(None),
    file: UploadFile | None = File(None),
    document_url: str | None = Form(None),
    is_verified: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    import uuid
    from app.models.customer_document import CustomerDocumentType
    try:
        doc_type_enum = CustomerDocumentType(document_type)
    except ValueError:
        doc_type_enum = CustomerDocumentType.OTHER

    final_url = document_url or f"documents/{customer_id}/{uuid.uuid4().hex[:12]}"
    if file:
        final_url = f"documents/{customer_id}/{uuid.uuid4().hex[:12]}_{file.filename}"

    doc = CustomerDocument(
        customer_id=customer_id,
        document_type=doc_type_enum,
        document_number=document_number,
        document_url=final_url,
        is_verified=is_verified,
        verified_by_user_id=current_user.id if is_verified else None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "customer_id": doc.customer_id,
        "document_type": doc.document_type.value,
        "document_number": doc.document_number,
        "is_verified": doc.is_verified,
        "created_at": doc.created_at,
    }


@router.delete("/{document_id}")
def admin_delete_customer_document(
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

    db.delete(document)
    db.commit()
    return {"message": "Document removed successfully"}

