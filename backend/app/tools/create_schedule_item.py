from sqlalchemy.orm import Session

from ..models import ScheduleItem
from ..schemas import ScheduleCreate


def create_schedule_item(db: Session, payload: ScheduleCreate) -> ScheduleItem:
    item = ScheduleItem(**payload.model_dump(exclude={"force"}))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

