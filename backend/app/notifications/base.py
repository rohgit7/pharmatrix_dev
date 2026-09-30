from abc import ABC, abstractmethod


class NotificationProvider(ABC):

    @abstractmethod
    def send(
        self,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:
        raise NotImplementedError