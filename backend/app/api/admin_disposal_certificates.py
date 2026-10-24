import uuid
from datetime import datetime
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.core.storage import create_disposal_certificate_signed_url
from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import DisposalShipment
from app.models.user import UserRole
from app.schemas.disposal_certificate import (
    DisposalCertificateResponse,
    DisposalCertificateUrlResponse,
)
from app.services.disposal_certificate_service import (
    delete_certificate_file,
    upload_disposal_certificate,
)

router = APIRouter(
    prefix="/api/admin/disposal-certificates",
    tags=["Admin - Disposal Certificates"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("/", response_model=list[DisposalCertificateResponse])
def admin_list_disposal_certificates(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    certificates = (
        db.query(DisposalCertificate)
        .order_by(DisposalCertificate.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        DisposalCertificateResponse(
            id=cert.id,
            public_id=cert.public_id,
            certificate_code=cert.certificate_code,
            shipment_id=cert.shipment.public_id if cert.shipment else uuid.uuid4(),
            certificate_number=cert.certificate_number,
            storage_path=cert.storage_path,
            file_name=cert.file_name,
            content_type=cert.content_type,
            issued_at=cert.issued_at,
            uploaded_at=cert.uploaded_at,
            notes=cert.notes,
        )
        for cert in certificates
    ]


@router.get("/{certificate_id}", response_model=DisposalCertificateResponse)
def admin_get_disposal_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    cert = db.query(DisposalCertificate).filter(DisposalCertificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disposal certificate not found",
        )

    return DisposalCertificateResponse(
        id=cert.id,
        public_id=cert.public_id,
        certificate_code=cert.certificate_code,
        shipment_id=cert.shipment.public_id if cert.shipment else uuid.uuid4(),
        certificate_number=cert.certificate_number,
        storage_path=cert.storage_path,
        file_name=cert.file_name,
        content_type=cert.content_type,
        issued_at=cert.issued_at,
        uploaded_at=cert.uploaded_at,
        notes=cert.notes,
    )


@router.get("/{certificate_id}/download", response_model=DisposalCertificateUrlResponse)
def admin_download_disposal_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    cert = db.query(DisposalCertificate).filter(DisposalCertificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disposal certificate not found",
        )

    url = create_disposal_certificate_signed_url(cert.storage_path, expires_in=3600)
    return {"url": url, "expires_in": 3600}


@router.post("/", response_model=DisposalCertificateResponse, status_code=status.HTTP_201_CREATED)
async def admin_upload_certificate(
    shipment_id: str = Form(...),
    certificate_number: str = Form(...),
    issued_at: datetime = Form(...),
    notes: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Lookup shipment by either public_id (UUID) or integer id
    try:
        shipment_uuid = uuid.UUID(shipment_id)
        shipment = db.query(DisposalShipment).filter(DisposalShipment.public_id == shipment_uuid).first()
    except ValueError:
        shipment = db.query(DisposalShipment).filter(DisposalShipment.id == int(shipment_id)).first()

    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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

    try:
        db.commit()
    except Exception:
        db.rollback()
        delete_certificate_file(certificate.storage_path)
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


@router.delete("/{certificate_id}", status_code=status.HTTP_200_OK)
def admin_delete_disposal_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    cert = db.query(DisposalCertificate).filter(DisposalCertificate.id == certificate_id).first()
    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disposal certificate not found",
        )

    storage_path = cert.storage_path
    db.delete(cert)
    db.commit()

    try:
        delete_certificate_file(storage_path)
    except Exception:
        pass

    return {"message": "Disposal certificate removed successfully"}
