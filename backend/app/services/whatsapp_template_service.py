from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import NotificationType
from app.models.whatsapp_template import WhatsAppTemplate


def get_template_for_notification(
    db: Session,
    notification_type: NotificationType,
) -> WhatsAppTemplate | None:

    return db.scalar(
        select(WhatsAppTemplate)
        .where(
            WhatsAppTemplate.notification_type
            == notification_type,
            WhatsAppTemplate.is_active.is_(True),
        )
        .order_by(WhatsAppTemplate.id.desc())
    )


def build_template_parameters(
    template: WhatsAppTemplate,
    metadata: dict | None,
) -> list[dict]:

    metadata = metadata or {}

    parameters = []

    for key in template.parameter_keys:

        if key not in metadata:
            raise ValueError(
                f"Missing WhatsApp template parameter: {key}"
            )

        parameters.append(
            {
                "type": "text",
                "text": str(metadata[key]),
            }
        )

    return parameters