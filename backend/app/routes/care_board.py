from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Attachment, CareEvent, Caregiver, ScheduleItem
from ..services.conflict_store import conflict_store

router = APIRouter(prefix="/care-board", tags=["care board"])

# The board only offers resolutions the /api/conflicts/resolve endpoint accepts.
RESOLUTION_OPTIONS = ["keep_both", "replace_existing", "discard_new"]


def event_dict(event: CareEvent, attachment: Attachment | None) -> dict:
    return {
        "id": event.id,
        "care_recipient_id": event.care_recipient_id,
        "caregiver_id": event.caregiver_id,
        "category": event.category,
        "event_time": event.event_time,
        "title": event.title,
        "details_json": event.details_json,
        "status": event.status,
        "source_type": event.source_type,
        "raw_input": event.raw_input,
        "attachment_id": event.attachment_id,
        # The timeline needs a URL, not just an id, to render the photo.
        "attachment": (
            {
                "attachment_id": attachment.id,
                "type": attachment.file_type,
                "file_url": attachment.file_url,
            }
            if attachment
            else None
        ),
        "confirmed_by_user": event.confirmed_by_user,
        "created_at": event.created_at,
    }


def schedule_dict(item: ScheduleItem) -> dict:
    return {
        "id": item.id,
        "care_recipient_id": item.care_recipient_id,
        "title": item.title,
        "start_time": item.start_time,
        "end_time": item.end_time,
        "assigned_caregiver_id": item.assigned_caregiver_id,
        "status": item.status,
        "notes": item.notes,
        "created_by": item.created_by,
    }


def open_conflicts(db: Session, care_recipient_id: str) -> list[dict]:
    """Schedule clashes still awaiting a decision.

    These are the same in-memory entries /api/conflicts/resolve consumes, so every
    conflict shown here is actionable. They expire with the store's 15-minute TTL.
    """
    conflicts: list[dict] = []
    for conflict_id, pending in conflict_store.list_open():
        incoming = pending.schedule
        if incoming.care_recipient_id != care_recipient_id:
            continue
        existing = db.get(ScheduleItem, pending.existing_schedule_id)
        if existing is None:  # the clashing item was deleted in the meantime
            continue
        duplicate = incoming.title.casefold() == existing.title.casefold()
        conflicts.append({
            "id": conflict_id,
            "type": "possible_duplicate" if duplicate else "overlap",
            "message": (
                f"{existing.title} is already recorded at "
                f"{existing.start_time.strftime('%H:%M')}."
                if duplicate
                else f"{incoming.title} overlaps {existing.title}."
            ),
            "existing": {
                "id": existing.id,
                "title": existing.title,
                "start_time": existing.start_time,
                "end_time": existing.end_time,
            },
            "incoming": {
                "title": incoming.title,
                "start_time": incoming.start_time,
                "end_time": incoming.end_time,
            },
            "resolution_options": RESOLUTION_OPTIONS,
            "status": "open",
        })
    return conflicts


@router.get("")
def care_board(care_recipient_id: str, date_value: date = Query(alias="date"), db: Session = Depends(get_db)):
    start = datetime.combine(date_value, time.min)
    end = start + timedelta(days=1)

    events = db.scalars(select(CareEvent).where(CareEvent.care_recipient_id == care_recipient_id, CareEvent.event_time >= start, CareEvent.event_time < end).order_by(CareEvent.event_time)).all()
    schedules = db.scalars(select(ScheduleItem).where(ScheduleItem.care_recipient_id == care_recipient_id, ScheduleItem.start_time >= start).order_by(ScheduleItem.start_time).limit(20)).all()
    caregivers = db.scalars(select(Caregiver).order_by(Caregiver.name)).all()

    attachment_ids = {event.attachment_id for event in events if event.attachment_id}
    attachments = (
        {a.id: a for a in db.scalars(select(Attachment).where(Attachment.id.in_(attachment_ids))).all()}
        if attachment_ids
        else {}
    )

    # Shift comes from the caregiver table, same rule as /api/bootstrap, so the two
    # endpoints cannot disagree about who is on duty.
    current = caregivers[0] if caregivers else None
    following = caregivers[1] if len(caregivers) > 1 else current

    return {
        "date": date_value,
        "events": [event_dict(event, attachments.get(event.attachment_id)) for event in events],
        "schedule_items": [schedule_dict(item) for item in schedules],
        "conflicts": open_conflicts(db, care_recipient_id),
        "caregivers": [
            {"id": c.id, "name": c.name, "relationship": c.relationship} for c in caregivers
        ],
        "current_caregiver": {"id": current.id, "name": current.name} if current else None,
        "next_caregiver": {"id": following.id, "name": following.name} if following else None,
        "shift_ends": datetime.combine(date_value, time(18, 0)),
    }
