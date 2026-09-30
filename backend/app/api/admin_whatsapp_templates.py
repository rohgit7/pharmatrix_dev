from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.whatsapp_template import WhatsAppTemplate
from app.schemas.whatsapp_template import (
    WhatsAppTemplateCreate,
    WhatsAppTemplateResponse,
    WhatsAppTemplateUpdate,
)

router = APIRouter(
    prefix="/api/admin/whatsapp/templates",
    tags=["Admin WhatsApp Templates"],
)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


@router.get(
    "",
    response_model=list[WhatsAppTemplateResponse],
)
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.scalars(
        select(WhatsAppTemplate)
        .order_by(
            WhatsAppTemplate.notification_type,
            WhatsAppTemplate.language_code,
            WhatsAppTemplate.id,
        )
    ).all()


@router.get(
    "/{template_id}",
    response_model=WhatsAppTemplateResponse,
)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(
        WhatsAppTemplate,
        template_id,
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WhatsApp template not found",
        )

    return template


@router.post(
    "",
    response_model=WhatsAppTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    data: WhatsAppTemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing_key = db.scalar(
        select(WhatsAppTemplate)
        .where(
            WhatsAppTemplate.template_key
            == data.template_key
        )
    )

    if existing_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template key already exists",
        )

    existing_type_language = db.scalar(
        select(WhatsAppTemplate)
        .where(
            WhatsAppTemplate.notification_type
            == data.notification_type,
            WhatsAppTemplate.language_code
            == data.language_code,
        )
    )

    if existing_type_language:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A template already exists for this "
                "notification type and language"
            ),
        )

    template = WhatsAppTemplate(
        notification_type=data.notification_type,
        template_key=data.template_key,
        meta_template_name=data.meta_template_name,
        language_code=data.language_code,
        parameter_keys=data.parameter_keys,
        is_active=data.is_active,
    )

    db.add(template)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="WhatsApp template already exists",
        )

    db.refresh(template)

    return template


@router.patch(
    "/{template_id}",
    response_model=WhatsAppTemplateResponse,
)
def update_template(
    template_id: int,
    data: WhatsAppTemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(
        WhatsAppTemplate,
        template_id,
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WhatsApp template not found",
        )

    updates = data.model_dump(
        exclude_unset=True,
    )

    if "template_key" in updates:
        existing = db.scalar(
            select(WhatsAppTemplate)
            .where(
                WhatsAppTemplate.template_key
                == updates["template_key"],
                WhatsAppTemplate.id != template_id,
            )
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template key already exists",
            )

    for field, value in updates.items():
        setattr(
            template,
            field,
            value,
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="WhatsApp template conflicts with another template",
        )

    db.refresh(template)

    return template


@router.post(
    "/{template_id}/activate",
    response_model=WhatsAppTemplateResponse,
)
def activate_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(
        WhatsAppTemplate,
        template_id,
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WhatsApp template not found",
        )

    template.is_active = True

    db.commit()
    db.refresh(template)

    return template


@router.post(
    "/{template_id}/deactivate",
    response_model=WhatsAppTemplateResponse,
)
def deactivate_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(
        WhatsAppTemplate,
        template_id,
    )

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WhatsApp template not found",
        )

    template.is_active = False

    db.commit()
    db.refresh(template)

    return template