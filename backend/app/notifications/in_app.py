from app.notifications.base import NotificationProvider


class InAppProvider(NotificationProvider):

    def send(
        self,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:
        return None