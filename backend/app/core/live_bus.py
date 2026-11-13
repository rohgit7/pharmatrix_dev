import asyncio
import logging
from collections import defaultdict
from typing import Dict, Set

logger = logging.getLogger(__name__)


class PickupLiveBus:
    """
    In-memory async PubSub event bus for live pickup updates.
    Allows SSE streams to wait for actual domain events (driver GPS pings,
    status changes, verification steps) instead of busy-polling the database.
    """

    def __init__(self) -> None:
        self._subscribers: Dict[int, Set[asyncio.Event]] = defaultdict(set)

    def subscribe(self, pickup_id: int, event: asyncio.Event) -> None:
        """Register an asyncio.Event listener for a specific pickup."""
        self._subscribers[pickup_id].add(event)

    def unsubscribe(self, pickup_id: int, event: asyncio.Event) -> None:
        """Unregister an event listener."""
        if pickup_id in self._subscribers:
            self._subscribers[pickup_id].discard(event)
            if not self._subscribers[pickup_id]:
                del self._subscribers[pickup_id]

    def notify_pickup(self, pickup_id: int) -> None:
        """
        Thread-safe and async-safe notification.
        Wakes up all active SSE connections waiting for this pickup.
        """
        events = list(self._subscribers.get(pickup_id, []))
        if not events:
            return

        for ev in events:
            try:
                loop = getattr(ev, "_loop", None)
                if loop and loop.is_running():
                    loop.call_soon_threadsafe(ev.set)
                else:
                    ev.set()
            except Exception as err:
                logger.debug("LiveBus notification failed for an event: %s", err)

    def notify_pickups(self, pickup_ids: list[int]) -> None:
        """Notify multiple pickups (e.g. all stops along an active driver route)."""
        for pid in pickup_ids:
            self.notify_pickup(pid)

    @property
    def active_subscribers_count(self) -> int:
        return sum(len(subscribers) for subscribers in self._subscribers.values())


# Singleton instance shared across the FastAPI application
pickup_live_bus = PickupLiveBus()

