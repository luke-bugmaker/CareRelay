from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from ..schemas import ScheduleCreate


@dataclass(frozen=True)
class PendingConflict:
    schedule: ScheduleCreate
    existing_schedule_id: str
    expires_at: datetime


class ConflictStore:
    def __init__(self, ttl_minutes: int = 15) -> None:
        self._ttl = timedelta(minutes=ttl_minutes)
        self._pending: dict[str, PendingConflict] = {}

    def create(self, schedule: ScheduleCreate, existing_schedule_id: str) -> str:
        self._remove_expired()
        conflict_id = token_urlsafe(18)
        self._pending[conflict_id] = PendingConflict(
            schedule=schedule,
            existing_schedule_id=existing_schedule_id,
            expires_at=datetime.now(timezone.utc) + self._ttl,
        )
        return conflict_id

    def take(self, conflict_id: str) -> PendingConflict | None:
        self._remove_expired()
        return self._pending.pop(conflict_id, None)

    def list_open(self) -> list[tuple[str, PendingConflict]]:
        """Unresolved conflicts, for display. Unlike take() this does not consume
        them — the care board reads the same entries the resolve endpoint acts on."""
        self._remove_expired()
        return list(self._pending.items())

    def _remove_expired(self) -> None:
        now = datetime.now(timezone.utc)
        for conflict_id in [
            key for key, value in self._pending.items() if value.expires_at <= now
        ]:
            self._pending.pop(conflict_id, None)


conflict_store = ConflictStore()
