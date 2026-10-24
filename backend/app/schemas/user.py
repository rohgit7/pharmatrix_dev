from uuid import UUID
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserResponse(BaseModel):
    id: int
    auth_user_id: UUID
    name: str
    email: str | None = None
    role: UserRole
    is_active: bool

    model_config = {
        "from_attributes": True
    }


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.CUSTOMER
    is_active: bool = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = None
