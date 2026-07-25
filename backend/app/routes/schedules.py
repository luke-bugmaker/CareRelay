from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScheduleItem
from ..schemas import ScheduleCreate, ScheduleRead, ScheduleUpdate
from ..services.conflict_engine import detect_schedule_conflicts

router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.post("", status_code=201)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    existing = list(db.scalars(select(ScheduleItem).where(ScheduleItem.care_recipient_id == payload.care_recipient_id)).all())
    conflicts = detect_schedule_conflicts(payload, existing)
    if conflicts and not payload.force:
        return {"status": "confirmation_required", "conflicts": conflicts, "resolution_options": ["keep_both", "replace_existing", "edit_new_item"]}
    item = ScheduleItem(**payload.model_dump(exclude={"force"}))
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"status": "created", "schedule_item_id": item.id, "conflicts": conflicts}


@router.patch("/{schedule_id}", response_model=ScheduleRead)
def update_schedule(schedule_id: str, payload: ScheduleUpdate, db: Session = Depends(get_db)):
    item = db.get(ScheduleItem, schedule_id)
    if not item:
        raise HTTPException(404, "Schedule item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

