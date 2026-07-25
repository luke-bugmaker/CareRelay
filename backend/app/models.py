from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Caregiver(Base):
    __tablename__ = "caregivers"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    relationship: Mapped[str | None] = mapped_column(String(100))


class CareEvent(Base):
    __tablename__ = "care_events"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("event"))
    care_recipient_id: Mapped[str] = mapped_column(String, index=True)
    caregiver_id: Mapped[str] = mapped_column(String, index=True)
    category: Mapped[str] = mapped_column(String(40))
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    title: Mapped[str] = mapped_column(String(160))
    details_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="completed")
    source_type: Mapped[str] = mapped_column(String(30), default="text")
    raw_input: Mapped[str | None] = mapped_column(Text)
    attachment_id: Mapped[str | None] = mapped_column(String)
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ScheduleItem(Base):
    __tablename__ = "schedule_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("schedule"))
    care_recipient_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String(160))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_caregiver_id: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String)


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("attachment"))
    file_type: Mapped[str] = mapped_column(String(30))
    file_url: Mapped[str] = mapped_column(String)
    uploaded_by: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

