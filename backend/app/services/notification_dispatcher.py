from app.models.enums import NotificationChannel
from app.notifications.email import EmailProvider
from app.notifications.in_app import InAppProvider
from app.notifications.whatsapp import WhatsAppProvider


class NotificationDispatcher:

    def __init__(self):
        self.providers = {
            NotificationChannel.IN_APP: InAppProvider(),
            NotificationChannel.WHATSAPP: WhatsAppProvider(),
            NotificationChannel.EMAIL: EmailProvider(),
        }

    def send(
        self,
        channel: NotificationChannel,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:

        provider = self.providers.get(channel)

        if not provider:
            raise ValueError(
                f"No provider configured for channel: {channel}"
            )

        return provider.send(
            recipient=recipient,
            title=title,
            body=body,
            metadata=metadata,
        )