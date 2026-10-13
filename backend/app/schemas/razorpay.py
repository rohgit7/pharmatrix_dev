
from pydantic import BaseModel, Field
from uuid import UUID

class RazorpayOrderCreateRequest(BaseModel):
    invoice_id: UUID


class RazorpayOrderResponse(BaseModel):
    key_id: str
    order_id: str
    amount: int
    currency: str
    status: str


class RazorpayPaymentVerificationRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class RazorpayPaymentVerificationResponse(BaseModel):
    status: str
    message: str
    payment_id: int | None = None
