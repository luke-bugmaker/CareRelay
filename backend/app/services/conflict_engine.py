from datetime import datetime, timedelta

from ..models import ScheduleItem
from ..schemas import ScheduleCreate


def _naive(value: datetime) -> datetime:
    """Schemas normalise incoming datetimes, but rows written before that fix (or
    by another path) can still carry a timezone. Comparing the two raises."""
    return value.astimezone().replace(tzinfo=None) if value.tzinfo else value


def detect_schedule_conflicts(candidate: ScheduleCreate, existing: list[ScheduleItem]) -> list[dict]:
    candidate_start = _naive(candidate.start_time)
    candidate_end = _naive(candidate.end_time) if candidate.end_time else candidate_start + timedelta(hours=1)
    conflicts: list[dict] = []
    for item in existing:
        item_start = _naive(item.start_time)
        existing_end = _naive(item.end_time) if item.end_time else item_start + timedelta(hours=1)
        if candidate_start < existing_end and candidate_end > item_start:
            kind = "possible_duplicate" if candidate.title.casefold() == item.title.casefold() else "overlap"
            conflicts.append({
                "type": kind,
                "existing_schedule_id": item.id,
                "message": f"{candidate.title} conflicts with {item.title} at {item.start_time.isoformat()}.",
            })
    return conflicts

