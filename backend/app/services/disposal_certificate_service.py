from datetime import datetime, timezone
import secrets

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.supabase import create_client
from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import DisposalShipment
from app.models.enums import DisposalShipmentStatus

from app.models.customer import Customer
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.pickup import Pickup
from app.models.warehouse_intake import WarehouseIntake
from app.models.enums import RouteStopType

from app.services.notification_events import (
    notify_disposal_completed,
)

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}


def generate_certificate_code() -> str:
    return f"DC-{secrets.token_hex(4).upper()}"


async def upload_disposal_certificate(
    db: Session,
    shipment_id: int,
    certificate_number: str,
    issued_at: datetime,
    file: UploadFile,
    notes: str | None = None,
) -> DisposalCertificate:

    shipment = db.scalar(
        select(DisposalShipment)
        .where(DisposalShipment.id == shipment_id)
        .with_for_update()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.status not in (
        DisposalShipmentStatus.RECEIVED,
        DisposalShipmentStatus.DISCREPANCY,
    ):
        raise HTTPException(
            status_code=409,
            detail="Shipment must be received before uploading disposal certificate",
        )

    existing = db.scalar(
        select(DisposalCertificate)
        .where(
            DisposalCertificate.shipment_id == shipment_id
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Disposal certificate already exists for this shipment",
        )

    content_type = file.content_type

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG and PNG files are allowed",
        )

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Certificate file cannot exceed 10 MB",
        )

    extension = ALLOWED_CONTENT_TYPES[content_type]

    certificate_code = generate_certificate_code()

    storage_path = (
        f"shipments/{shipment.id}/"
        f"{certificate_code}{extension}"
    )

    try:
        supabase_admin.storage.from_(
            settings.SUPABASE_DISPOSAL_CERTIFICATE_BUCKET
        ).upload(
            storage_path,
            contents,
            {
                "content-type": content_type,
                "upsert": False,
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload certificate: {str(exc)}",
        )

    certificate = DisposalCertificate(
        certificate_code=certificate_code,
        shipment_id=shipment.id,
        certificate_number=certificate_number,
        storage_path=storage_path,
        file_name=file.filename or f"certificate{extension}",
        content_type=content_type,
        issued_at=issued_at,
        uploaded_at=datetime.now(timezone.utc),
        notes=notes,
    )

    db.add(certificate)

    shipment.status = DisposalShipmentStatus.DISPOSED

    db.flush()

    route = db.scalar(
        select(Route)
        .join(
            WarehouseIntake,
            WarehouseIntake.route_id == Route.id,
        )
        .where(
            WarehouseIntake.id == shipment.intake_id
        )
    )

    if route:
        pickups = db.scalars(
            select(Pickup)
            .join(
                RouteStop,
                RouteStop.pickup_id == Pickup.id,
            )
            .where(
                RouteStop.route_id == route.id,
                RouteStop.stop_type == RouteStopType.PICKUP,
            )
        ).all()

        notified_user_ids = set()

        for pickup in pickups:
            customer = db.get(
                Customer,
                pickup.customer_id,
            )

            if not customer:
                continue

            if customer.user_id in notified_user_ids:
                continue

            notify_disposal_completed(
                db,
                customer_user_id=customer.user_id,
                shipment_id=shipment.id,
                shipment_code=shipment.shipment_code,
            )

            notified_user_ids.add(customer.user_id)

    return certificate