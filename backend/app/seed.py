from datetime import datetime, timedelta

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import CareEvent, Caregiver, ScheduleItem


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(Caregiver.id).limit(1)):
            print("Seed data already exists.")
            return
        db.add_all([
            Caregiver(id="caregiver_amy", name="Amy", relationship="Daughter"),
            Caregiver(id="caregiver_ben", name="Ben", relationship="Son"),
            CareEvent(id="event_001", care_recipient_id="recipient_001", caregiver_id="caregiver_amy", category="nutrition", event_time=datetime.now().replace(hour=8, minute=30, second=0, microsecond=0), title="Breakfast", details_json={"food": "Porridge", "amount": "Half a bowl"}, raw_input="Dad ate half a bowl of porridge at 8:30."),
            ScheduleItem(id="schedule_001", care_recipient_id="recipient_001", title="Physiotherapy", start_time=datetime.now().replace(hour=15, minute=0, second=0, microsecond=0) + timedelta(days=1), end_time=datetime.now().replace(hour=16, minute=0, second=0, microsecond=0) + timedelta(days=1), assigned_caregiver_id="caregiver_ben", created_by="caregiver_amy"),
        ])
        db.commit()
        print("Seed data created.")


if __name__ == "__main__":
    seed()

