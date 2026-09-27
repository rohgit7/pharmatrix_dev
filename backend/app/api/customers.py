from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.customer import (
    CustomerOnboardRequest,
    CustomerResponse,
)
from app.services.customer_service import create_customer


router = APIRouter(
    prefix="/api/customers",
    tags=["Customers"],
)


@router.post(
    "/onboard",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def onboard_customer(
    data: CustomerOnboardRequest,
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    return create_customer(
        db=db,
        user=current_user,
        data=data,
    )

@router.get("/me")
def get_my_customer(
    current_user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(
            Customer.user_id == current_user.id
        )
        .first()
    )

    if not customer:
        return {
            "onboarded": False
        }

    return {
        "onboarded": True,
        "customer_id": customer.id,
        "customer_type": customer.customer_type.value,
        "legal_name": customer.legal_name,
        "display_name": customer.display_name,
    }