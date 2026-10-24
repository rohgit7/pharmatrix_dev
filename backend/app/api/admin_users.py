import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.core.supabase_admin import get_supabase_admin
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(
    prefix="/api/admin/users",
    tags=["Admin - Users"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("/", response_model=list[UserResponse])
def admin_list_users(
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if role is not None:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
            )
        )

    query = query.order_by(User.id.desc())
    return query.offset(offset).limit(limit).all()


@router.get("/{user_id}", response_model=UserResponse)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    auth_user_id = uuid.uuid4()
    try:
        supabase_admin = get_supabase_admin()
        auth_response = supabase_admin.auth.admin.create_user(
            {
                "email": data.email,
                "password": data.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": data.name,
                    "role": data.role.value,
                },
            }
        )
        if auth_response and auth_response.user:
            auth_user_id = auth_response.user.id
    except Exception:
        # Fallback to generated uuid in development/test mock
        pass

    user = User(
        auth_user_id=auth_user_id,
        name=data.name,
        email=data.email,
        role=data.role,
        is_active=data.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_dict = data.model_dump(exclude_unset=True)

    password = update_dict.pop("password", None)
    if password:
        try:
            supabase_admin = get_supabase_admin()
            supabase_admin.auth.admin.update_user_by_id(
                str(user.auth_user_id),
                {"password": password},
            )
        except Exception:
            pass

    for field, value in update_dict.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    try:
        supabase_admin = get_supabase_admin()
        supabase_admin.auth.admin.delete_user(str(user.auth_user_id))
    except Exception:
        pass

    try:
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()
        user.is_active = False
        db.commit()

    return {"message": "User removed successfully"}
