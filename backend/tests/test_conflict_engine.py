from datetime import datetime, timedelta

from app.models import ScheduleItem
from app.schemas import ScheduleCreate
from app.services.conflict_engine import detect_schedule_conflicts


def test_detects_overlapping_schedule():
    start = datetime(2026, 7, 25, 15, 0)
    existing = ScheduleItem(id="schedule_existing", care_recipient_id="recipient_001", title="Appointment", start_time=start, end_time=start + timedelta(hours=1), created_by="caregiver_amy")
    candidate = ScheduleCreate(care_recipient_id="recipient_001", title="Physiotherapy", start_time=start + timedelta(minutes=30), end_time=start + timedelta(hours=2), created_by="caregiver_ben")
    conflicts = detect_schedule_conflicts(candidate, [existing])
    assert conflicts[0]["type"] == "overlap"

