from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.core.storage import create_signed_storage_url
from app.models.enums import RouteStopType
from app.models.route_stop import RouteStop
from app.models.user import UserRole


router = APIRouter(
    prefix="/api/admin/collection-proofs",
    tags=["Admin - Collection Proofs"],
    dependencies=[
        Depends(require_role(UserRole.ADMIN))
    ],
)


@router.get("/{stop_id}/url")
def get_collection_proof_url_admin(
    stop_id: int,
    db: Session = Depends(get_db),
):
    stop = (
        db.query(RouteStop)
        .filter(RouteStop.id == stop_id)
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

    signed_url = create_signed_storage_url(
        storage_path=stop.proof_storage_path,
        expires_in=3600,
    )

    return {
        "stop_id": stop.id,
        "proof_uploaded": True,
        "expires_in": 3600,
        "signed_url": signed_url,
    }