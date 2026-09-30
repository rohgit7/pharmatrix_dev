from datetime import datetime

from pydantic import BaseModel


class DisposalCertificateResponse(BaseModel):
    id: int
    certificate_code: str
    shipment_id: int
    certificate_number: str
    storage_path: str
    file_name: str
    content_type: str
    issued_at: datetime
    uploaded_at: datetime
    notes: str | None = None

    model_config = {
        "from_attributes": True
    }


class DisposalCertificateUrlResponse(BaseModel):
    url: str
    expires_in: int