from pydantic import BaseModel, Field


class ArriveAtStopRequest(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0)


class CompletePickupRequest(BaseModel):
    collected_weight_kg: float = Field(
        ge=0,
        le=10000,
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
    )


class FailStopRequest(BaseModel):
    reason: str = Field(
        min_length=1,
        max_length=1000,
    )


class UploadProofBase64Request(BaseModel):
    image_base64: str = Field(min_length=1)
    file_name: str | None = Field(default="collection_proof.jpg")
