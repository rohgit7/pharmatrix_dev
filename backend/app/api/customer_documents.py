import uuid

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

    contents = await file.read()

    validate_file_signature(
        contents,
        file.content_type,
    )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File must be smaller than 10 MB",
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

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {str(exc)}",
        )

    # ---------------------------------------------------------
    # Save metadata to PostgreSQL
    # ---------------------------------------------------------

    document = CustomerDocument(
        customer_id=customer.id,
        document_type=document_type,
        document_number=document_number,
        document_url=storage_path,
        is_verified=False,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "document_type": document.document_type.value,
        "document_number": document.document_number,
        "storage_path": storage_path,
        "is_verified": document.is_verified,
    }