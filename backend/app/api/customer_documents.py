import uuid
from app.core.storage import (
    supabase_storage,
    create_customer_document_signed_url,
)

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session
from app.core.file_validation import (
    validate_file_signature,
)
from app.core.auth import require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.storage import supabase_storage
from app.models.customer import Customer
from app.models.customer_document import (
    CustomerDocument,
    CustomerDocumentType,
)
from app.models.user import User, UserRole


router = APIRouter(
    prefix="/api/customers/documents",
    tags=["Customer Documents"],
)


ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
}

CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}


MAX_FILE_SIZE = 10 * 1024 * 1024

@router.post("/")
async def upload_customer_document(
    document_type: CustomerDocumentType = Form(...),
    document_number: str | None = Form(None),
    file: UploadFile = File(...),

    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),

    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # Find the logged-in customer's profile
    # ---------------------------------------------------------

    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Customer profile not found",
        )

    # ---------------------------------------------------------
    # Validate file type
    # ---------------------------------------------------------

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Use PDF, JPG or PNG."
            ),
        )

    # ---------------------------------------------------------
    # Read file
    # ---------------------------------------------------------

    contents = await file.read(MAX_FILE_SIZE + 1)

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File must not exceed 10 MB",
        )

    validate_file_signature(
        contents,
        file.content_type,
    )

    # ---------------------------------------------------------
    # Generate safe storage path
    # ---------------------------------------------------------

    extension = CONTENT_TYPE_EXTENSIONS[
        file.content_type
    ]

    unique_name = (
        f"{uuid.uuid4().hex}{extension}"
    )

    storage_path = (
        f"customers/"
        f"{customer.id}/"
        f"documents/"
        f"{unique_name}"
    )

    # ---------------------------------------------------------
    # Upload to Supabase Storage
    # ---------------------------------------------------------

    try:
        supabase_storage.storage \
            .from_(settings.SUPABASE_STORAGE_BUCKET) \
            .upload(
                path=storage_path,
                file=contents,
                file_options={
                    "content-type": file.content_type,
                    "upsert": "false",
                },
            )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Document upload failed",
        )


    # Save metadata to PostgreSQL
    document = CustomerDocument(
        customer_id=customer.id,
        document_type=document_type,
        document_number=document_number,
        document_url=storage_path,
        is_verified=False,
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)

    except Exception:
        db.rollback()

        # Remove the uploaded file if the database save fails.
        try:
            supabase_storage.storage \
                .from_(settings.SUPABASE_STORAGE_BUCKET) \
                .remove([storage_path])
        except Exception:
            # Cleanup failure should not hide the database failure.
            pass

        raise HTTPException(
            status_code=500,
            detail="Document metadata could not be saved",
        )

    return {
        "id": document.id,
        "document_type": document.document_type.value,
        "document_number": document.document_number,
        "storage_path": storage_path,
        "is_verified": document.is_verified,
    }


@router.get("/")
def list_customer_documents(
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Customer profile not found",
        )

    documents = (
        db.query(CustomerDocument)
        .filter(
            CustomerDocument.customer_id == customer.id
        )
        .order_by(CustomerDocument.created_at.desc())
        .all()
    )

    return [
        {
            "id": document.id,
            "document_type": document.document_type.value,
            "document_number": document.document_number,
            "is_verified": document.is_verified,
            "created_at": document.created_at,
        }
        for document in documents
    ]


@router.get("/{document_id}/download")
def download_customer_document(
    document_id: int,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Customer profile not found",
        )

    document = (
        db.query(CustomerDocument)
        .filter(
            CustomerDocument.id == document_id,
            CustomerDocument.customer_id == customer.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    try:
        signed_url = create_customer_document_signed_url(
            document.document_url,
            expires_in=300,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate document download link",
        )

    return {"download_url": signed_url}
