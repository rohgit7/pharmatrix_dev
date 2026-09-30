from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import DisposalShipmentStatus


class CustomerDisposalRecordResponse(BaseModel):
    pickup_id: int
    pickup_code: str

    shipment_id: int | None = None
    shipment_code: str | None = None

    facility_name: str | None = None

    expected_weight_kg: Decimal | None = None
    received_weight_kg: Decimal | None = None

    shipment_status: DisposalShipmentStatus | None = None

    dispatched_at: datetime | None = None
    received_at: datetime | None = None

    certificate_available: bool = False

    model_config = {
        "from_attributes": True
    }


class CustomerCertificateUrlResponse(BaseModel):
    url: str
    expires_in: int