
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.razorpay_service import process_razorpay_webhook


router = APIRouter(
    prefix="/api/webhooks/razorpay",
    tags=["Razorpay Webhooks"],
)


@router.post("")
async def razorpay_webhook(
    request: Request,
    signature: Annotated[
        str,
        Header(alias="X-Razorpay-Signature"),
    ],
    event_id: Annotated[
        str,
        Header(alias="X-Razorpay-Event-Id"),
    ],
    db: Session = Depends(get_db),
):
    raw_body = await request.body()

    return process_razorpay_webhook(
        db=db,
        raw_body=raw_body,
        signature=signature,
        event_id=event_id,
    )
