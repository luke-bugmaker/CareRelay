from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CareEvent, ScheduleItem


def get_handoff_records(
    db: Session,
    recipient_id: str,
    start: datetime,
    end: datetime,
) -> dict:
    events = db.scalars(select(CareEvent).where(
        CareEvent.care_recipient_id == recipient_id,
        CareEvent.event_time >= start,
        CareEvent.event_time <= end,
    ).order_by(CareEvent.event_time)).all()
    schedules = db.scalars(select(ScheduleItem).where(
        ScheduleItem.care_recipient_id == recipient_id,
        ScheduleItem.start_time >= start,
    ).order_by(ScheduleItem.start_time)).all()
    return {
        "range": {"from": start.isoformat(), "to": end.isoformat()},
        "events": [
            {
                "id": event.id,
                "category": event.category,
                "event_time": event.event_time.isoformat(),
                "title": event.title,
                "details": event.details_json,
                "status": event.status,
                "raw_input": event.raw_input,
                "confirmed_by_user": event.confirmed_by_user,
            }
            for event in events
        ],
        "schedule_items": [
            {
                "id": item.id,
                "title": item.title,
                "start_time": item.start_time.isoformat(),
                "end_time": item.end_time.isoformat() if item.end_time else None,
                "status": item.status,
                "notes": item.notes,
            }
            for item in schedules
        ],
    }


def build_handoff(db: Session, recipient_id: str, start: datetime, end: datetime) -> dict:
    records = get_handoff_records(db, recipient_id, start, end)
    events = records["events"]
    schedules = records["schedule_items"]
    return {
        "completed": [{"text": f"{event['title']} was recorded at {event['event_time']}.", "event_ids": [event["id"]], "schedule_ids": []} for event in events if event["status"] == "completed"],
        "needs_attention": [{"text": f"{item['title']} is still {item['status']}.", "event_ids": [], "schedule_ids": [item["id"]]} for item in schedules if item["status"] == "pending"],
        "condition_changes": [],
        "upcoming": [{"text": f"{item['title']} is scheduled for {item['start_time']}.", "event_ids": [], "schedule_ids": [item["id"]]} for item in schedules[:5]],
        "conflicts": [],
        "unconfirmed_information": [],
    }

