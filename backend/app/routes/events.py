from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CareEvent
from ..schemas import CareEventCreate, CareEventRead, CareEventUpdate

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=CareEventRead, status_code=201)
def create_event(payload: CareEventCreate, db: Session = Depends(get_db)):
    event = CareEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}", response_model=CareEventRead)
def update_event(event_id: str, payload: CareEventUpdate, db: Session = Depends(get_db)):
    event = db.get(CareEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event

