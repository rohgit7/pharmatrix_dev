from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.supabase import supabase
from app.models.user import User


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(
    data: LoginRequest,
):
    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": data.email,
                "password": data.password,
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not response.session or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed",
        )

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "token_type": "bearer",
        "user_id": str(response.user.id),
    }


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "auth_user_id": str(current_user.auth_user_id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }