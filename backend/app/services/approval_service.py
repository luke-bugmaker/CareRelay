from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from ..schemas import ChatRequest, ConversationOutput


@dataclass(frozen=True)
class PendingWrite:
    request: ChatRequest
    output: ConversationOutput
    expires_at: datetime


class ApprovalStore:
    """Short-lived write previews for the single-process hackathon backend."""

    def __init__(self, ttl_minutes: int = 15) -> None:
        self._ttl = timedelta(minutes=ttl_minutes)
        self._pending: dict[str, PendingWrite] = {}

    def create(self, request: ChatRequest, output: ConversationOutput) -> str:
        self._remove_expired()
        approval_id = token_urlsafe(24)
        self._pending[approval_id] = PendingWrite(
            request=request,
            output=output,
            expires_at=datetime.now(timezone.utc) + self._ttl,
        )
        return approval_id

    def take(self, approval_id: str) -> PendingWrite | None:
        self._remove_expired()
        return self._pending.pop(approval_id, None)

    def discard(self, approval_id: str) -> bool:
        self._remove_expired()
        return self._pending.pop(approval_id, None) is not None

    def _remove_expired(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [
            approval_id
            for approval_id, item in self._pending.items()
            if item.expires_at <= now
        ]
        for approval_id in expired:
            self._pending.pop(approval_id, None)


approval_store = ApprovalStore()
