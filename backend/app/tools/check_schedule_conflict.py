from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ScheduleItem
from ..schemas import ScheduleCreate
from ..services.conflict_engine import detect_schedule_conflicts


def check_schedule_conflict(db: Session, payload: ScheduleCreate) -> list[dict]:
    existing = list(db.scalars(select(ScheduleItem).where(
        ScheduleItem.care_recipient_id == payload.care_recipient_id
    )).all())
    return detect_schedule_conflicts(payload, existing)

