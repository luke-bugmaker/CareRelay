from datetime import datetime

from sqlalchemy.orm import Session

from ..services.handoff_service import build_handoff


def get_handoff_context(
    db: Session,
    care_recipient_id: str,
    start: datetime,
    end: datetime,
) -> dict:
    return build_handoff(db, care_recipient_id, start, end)

