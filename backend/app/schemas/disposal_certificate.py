from datetime import datetime
from uuid import UUID
from typing import Any

from pydantic import BaseModel


class DisposalCertificateResponse(BaseModel):
    id: int
    public_id: UUID
    certificate_code: str
    shipment_id: Any
    shipment_code: str | None = None
    facility_id: int | None = None
    facility_name: str | None = None
    facility_code: str | None = None
    certificate_number: str
    storage_path: str
    storage_key: str | None = None
    file_name: str
    content_type: str
    sha256_hash: str | None = None
    issued_at: datetime
    uploaded_at: datetime
    notes: str | None = None

    model_config = {"from_attributes": True}


class DisposalCertificateUrlResponse(BaseModel):
    url: str
    download_url: str | None = None
    expires_in: int = 3600
    certificate_id: int | None = None
    certificate_number: str | None = None
