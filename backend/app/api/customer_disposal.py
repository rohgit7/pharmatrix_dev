from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.customer import Customer
from app.models.user import UserRole
from app.schemas.customer_disposal import (
    CustomerDisposalRecordResponse,
)
from app.services.customer_disposal_service import (
    get_customer_disposal_records,
)

router = APIRouter(
    prefix="/api/customer/disposal",
    tags=["Customer Disposal"],
)

@router.get(
    "/",
    response_model=list[CustomerDisposalRecordResponse],
)
def get_my_disposal_records(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(UserRole.CUSTOMER)
    ),
):
    customer = db.query(Customer).filter(
        Customer.user_id == current_user.id
    ).first()

    if not customer:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Customer profile not found",
        )

    return get_customer_disposal_records(
        db=db,
        customer_id=customer.id,
    )