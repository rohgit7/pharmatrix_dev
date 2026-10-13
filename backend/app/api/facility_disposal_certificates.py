from datetime import datetime
from uuid import UUID
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.facility import Facility
from app.models.user import UserRole
from app.schemas.disposal_certificate import DisposalCertificateResponse
from app.services.disposal_certificate_service import (
    upload_disposal_certificate,
)
from app.core.storage import create_signed_storage_url
from app.core.storage import create_disposal_certificate_signed_url
from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import DisposalShipment
from app.schemas.disposal_certificate import DisposalCertificateUrlResponse

router = APIRouter(
    prefix="/api/facility/disposal-certificates",
    tags=["Facility Disposal Certificates"],
)

@router.get(
    "/{shipment_id}/url",
    response_model=DisposalCertificateUrlResponse,
)
def get_certificate_url(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(UserRole.FACILITY)
    ),
):
    facility = db.scalar(
        select(Facility)
        .where(Facility.user_id == current_user.id)
    )

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility profile not found",
        )

    certificate = db.scalar(
        select(DisposalCertificate)
        .join(DisposalCertificate.shipment)
        .where(
            DisposalShipment.public_id == shipment_id,
            DisposalShipment.facility_id == facility.id,
        )
    )

    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Disposal certificate not found",
        )

    # CREATE SIGNED URL HERE
    url = create_disposal_certificate_signed_url(
        certificate.storage_path,
        expires_in=3600,
    )

    return {
        "url": url,
        "expires_in": 3600,
    }

@router.post(
    "/{shipment_id}",
    response_model=DisposalCertificateResponse,
)
async def upload_certificate(
    shipment_id: UUID,

    certificate_number: str = Form(...),

    issued_at: datetime = Form(...),

    notes: str | None = Form(None),

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user=Depends(
        require_role(UserRole.FACILITY)
    ),
):
    facility = db.scalar(
        select(Facility)
        .where(
            Facility.user_id == current_user.id
        )
    )

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility profile not found",
        )

    from app.models.disposal_shipment import DisposalShipment

    shipment = db.scalar(
        select(DisposalShipment)
        .where(
            DisposalShipment.public_id == shipment_id,
            DisposalShipment.facility_id == facility.id,
        )
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    certificate = await upload_disposal_certificate(
        db=db,
        shipment_id=shipment.id,
        certificate_number=certificate_number,
        issued_at=issued_at,
        file=file,
        notes=notes,
    )

    storage_path = certificate.storage_path

    try:
        db.commit()

    except Exception:
        db.rollback()

        from app.services.disposal_certificate_service import (
            delete_certificate_file,
        )

        delete_certificate_file(
            storage_path
        )

        raise

    db.refresh(certificate)

    return DisposalCertificateResponse(
        id=certificate.id,
        public_id=certificate.public_id,
        certificate_code=certificate.certificate_code,
        shipment_id=shipment.public_id,
        certificate_number=certificate.certificate_number,
        storage_path=certificate.storage_path,
        file_name=certificate.file_name,
        content_type=certificate.content_type,
        issued_at=certificate.issued_at,
        uploaded_at=certificate.uploaded_at,
        notes=certificate.notes,
    )