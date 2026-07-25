from sqlalchemy.orm import Session

from ..models import CareEvent
from ..schemas import CareEventCreate


def create_care_event(db: Session, payload: CareEventCreate) -> CareEvent:
    event = CareEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

