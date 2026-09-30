from datetime import datetime

from pydantic import BaseModel, Field


class PickupVerificationResponse(BaseModel):
    pickup_id: int
    pickup_code: str

    verification_token: str

    qr_verified: bool
    qr_verified_at: datetime | None

    otp_verified: bool
    otp_verified_at: datetime | None

    otp_expires_at: datetime | None


class RequestOTPResponse(BaseModel):
    pickup_id: int
    otp: str
    expires_at: datetime
    message: str


class VerifyQRRequest(BaseModel):
    qr_token: str = Field(
        min_length=10,
        max_length=128,
    )


class VerifyOTPRequest(BaseModel):
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )