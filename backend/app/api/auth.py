import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from app.core.rate_limiter import limiter
from app.core.auth import get_current_user
from app.core.database import SessionLocal, get_db
from app.core.supabase import supabase
from app.core.supabase_admin import get_supabase_admin
from app.models.enums import UserRole
from app.models.user import User


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterCustomerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


@router.post("/login")
@limiter.limit("10/minute")
def login(
    request: Request,
    data: LoginRequest,
):
    clean_email = data.email.strip().lower()
    response = None
    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": clean_email,
                "password": data.password,
            }
        )
    except Exception:
        # Check if this is an active user created via the Admin Portal without a Supabase Auth record yet
        if len(data.password) >= 6:
            db = SessionLocal()
            try:
                db_user = (
                    db.query(User)
                    .filter(User.email == clean_email, User.is_active.is_(True))
                    .first()
                )
                if db_user:
                    admin_client = get_supabase_admin()
                    supabase_user_exists = False
                    try:
                        existing_sb = admin_client.auth.admin.get_user_by_id(
                            str(db_user.auth_user_id)
                        )
                        if existing_sb and getattr(existing_sb, "user", None):
                            supabase_user_exists = True
                    except Exception:
                        supabase_user_exists = False

                    if not supabase_user_exists:
                        created_auth = admin_client.auth.admin.create_user(
                            {
                                "email": clean_email,
                                "password": data.password,
                                "email_confirm": True,
                                "user_metadata": {
                                    "name": db_user.name,
                                    "role": db_user.role.value,
                                },
                            }
                        )
                        db_user.auth_user_id = uuid.UUID(str(created_auth.user.id))
                        db.commit()
                        response = supabase.auth.sign_in_with_password(
                            {
                                "email": clean_email,
                                "password": data.password,
                            }
                        )
            except Exception:
                response = None
            finally:
                db.close()

        if not response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    if not response or not response.session or not response.user:
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


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_customer(
    request: Request,
    data: RegisterCustomerRequest,
    db: Session = Depends(get_db),
):
    clean_email = data.email.strip().lower()
    existing_user = (
        db.query(User)
        .filter(User.email == clean_email)
        .first()
    )
    if existing_user:
        try:
            admin_client = get_supabase_admin()
            existing_sb = admin_client.auth.admin.get_user_by_id(
                str(existing_user.auth_user_id)
            )
            if existing_sb and getattr(existing_sb, "user", None):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists",
                )
        except HTTPException:
            raise
        except Exception:
            # User row was pre-created in Admin Portal without a Supabase Auth user; link it
            try:
                admin_client = get_supabase_admin()
                created_auth = admin_client.auth.admin.create_user(
                    {
                        "email": clean_email,
                        "password": data.password,
                        "email_confirm": True,
                        "user_metadata": {
                            "name": data.name.strip() or existing_user.name,
                            "role": existing_user.role.value,
                        },
                    }
                )
                existing_user.auth_user_id = uuid.UUID(str(created_auth.user.id))
                existing_user.name = data.name.strip() or existing_user.name
                db.commit()
                db.refresh(existing_user)
                login_res = supabase.auth.sign_in_with_password(
                    {
                        "email": clean_email,
                        "password": data.password,
                    }
                )
                return {
                    "id": existing_user.id,
                    "auth_user_id": str(existing_user.auth_user_id),
                    "name": existing_user.name,
                    "email": existing_user.email,
                    "role": existing_user.role.value,
                    "access_token": login_res.session.access_token if login_res.session else None,
                    "refresh_token": login_res.session.refresh_token if login_res.session else None,
                    "token_type": "bearer",
                }
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to activate existing customer account: {exc}",
                ) from exc

    try:
        admin_client = get_supabase_admin()
        created_auth = admin_client.auth.admin.create_user(
            {
                "email": clean_email,
                "password": data.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": data.name.strip(),
                    "role": UserRole.CUSTOMER.value,
                },
            }
        )
        auth_user_id = uuid.UUID(str(created_auth.user.id))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to register account: {exc}",
        ) from exc

    user = User(
        auth_user_id=auth_user_id,
        name=data.name.strip(),
        email=clean_email,
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Sign in to return active session tokens
    try:
        login_res = supabase.auth.sign_in_with_password(
            {
                "email": clean_email,
                "password": data.password,
            }
        )
        return {
            "id": user.id,
            "auth_user_id": str(user.auth_user_id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "access_token": login_res.session.access_token if login_res.session else None,
            "refresh_token": login_res.session.refresh_token if login_res.session else None,
            "token_type": "bearer",
        }
    except Exception:
        return {
            "id": user.id,
            "auth_user_id": str(user.auth_user_id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "access_token": None,
            "refresh_token": None,
            "token_type": "bearer",
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
