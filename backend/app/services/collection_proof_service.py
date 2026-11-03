from datetime import datetime, timezone
import base64
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.core.file_validation import (
    validate_file_signature,
)
from app.core.config import settings
from app.core.supabase_admin import get_supabase_admin
from app.models.enums import (
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
)
from app.models.route_stop import RouteStop
from app.services.route_execution_service import get_driver_route
from app.core.storage import create_signed_storage_url

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}

MAX_FILE_SIZE = 10 * 1024 * 1024


def get_collection_proof_url(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    expires_in: int = 3600,
):
    _, route = get_driver_route(
        db,
        user,
        route_id,
    )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP:
        raise HTTPException(
            status_code=400,
            detail="Collection proof is only available for pickup stops",
        )

    if not stop.proof_storage_path:
        raise HTTPException(
            status_code=404,
            detail="Collection proof has not been uploaded",
        )

    try:
        signed_url = create_signed_storage_url(
            storage_path=stop.proof_storage_path,
            expires_in=expires_in,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate proof URL: {exc}",
        )

    return {
        "stop_id": stop.id,
        "route_id": route.id,
        "proof_uploaded": True,
        "expires_in": expires_in,
        "signed_url": signed_url,
    }


def _save_proof_bytes(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    contents: bytes,
    content_type: str,
) -> RouteStop:
    _, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP:
        raise HTTPException(
            status_code=400,
            detail="Collection proof is only required for pickup stops",
        )

    if stop.execution_status not in {
        RouteStopStatus.ARRIVED,
        RouteStopStatus.IN_PROGRESS,
    }:
        raise HTTPException(
            status_code=400,
            detail="Driver must arrive at the pickup before uploading proof",
        )

    if stop.pickup is None:
        raise HTTPException(
            status_code=500,
            detail="Pickup not found",
        )

    if stop.pickup.qr_verified_at is None:
        raise HTTPException(
            status_code=409,
            detail="Pickup QR has not been verified",
        )

    if stop.pickup.otp_verified_at is None:
        raise HTTPException(
            status_code=409,
            detail="Customer OTP has not been verified",
        )

    # Normalize image/jpg -> image/jpeg
    normalized_content_type = content_type.lower()
    if normalized_content_type == "image/jpg":
        normalized_content_type = "image/jpeg"

    if normalized_content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG images are allowed",
        )

    validate_file_signature(
        contents,
        normalized_content_type,
    )

    def validate_image_signature(
        data: bytes,
        c_type: str,
    ) -> bool:
        if c_type in {"image/jpeg", "image/jpg"}:
            return data.startswith(b"\xFF\xD8\xFF")
        if c_type == "image/png":
            return data.startswith(b"\x89PNG\r\n\x1a\n")
        return False

    if not validate_image_signature(
        contents,
        normalized_content_type,
    ):
        raise HTTPException(
            status_code=400,
            detail="File content does not match the declared image type",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size cannot exceed 10 MB",
        )

    extension = ALLOWED_CONTENT_TYPES[normalized_content_type]

    storage_path = (
        f"routes/{route.id}/"
        f"stops/{stop.id}/"
        f"{uuid4().hex}{extension}"
    )

    supabase = get_supabase_admin()

    try:
        supabase.storage.from_(
            settings.SUPABASE_PICKUP_PROOF_BUCKET
        ).upload(
            storage_path,
            contents,
            {
                "content-type": normalized_content_type,
                "upsert": "true",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to upload collection proof: {exc}",
        )

    stop.proof_storage_path = storage_path
    stop.proof_uploaded_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(stop)

    return stop


async def upload_collection_proof(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    file: UploadFile,
):
    contents = await file.read()
    return _save_proof_bytes(
        db=db,
        user=user,
        route_id=route_id,
        stop_id=stop_id,
        contents=contents,
        content_type=file.content_type or "image/jpeg",
    )


def upload_collection_proof_base64(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    image_base64: str,
):
    raw = image_base64.strip()
    content_type = "image/jpeg"
    if raw.startswith("data:"):
        header, _, data = raw.partition(",")
        if "image/png" in header.lower():
            content_type = "image/png"
        raw = data

    try:
        contents = base64.b64decode(raw)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid base64 image data: {exc}",
        )

    return _save_proof_bytes(
        db=db,
        user=user,
        route_id=route_id,
        stop_id=stop_id,
        contents=contents,
        content_type=content_type,
    )
