from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _to_local_naive(value: Any) -> Any:
    """Drop the timezone, converting to server-local time first.

    The browser and the AI agent both send offsets ("...+08:00"), but SQLite
    stores naive datetimes, so rows read back have no tzinfo. Comparing the two
    raises "can't compare offset-naive and offset-aware datetimes", which surfaced
    as a 500 from the conflict engine. Normalising on the way in keeps every
    datetime in the system naive local time.
    """
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


# Use in place of `datetime` on any field that arrives from a client or the model.
LocalDateTime = Annotated[datetime, BeforeValidator(_to_local_naive)]


Category = Literal["nutrition", "hydration", "activity", "medication", "symptom", "emotion", "vital_sign", "appointment", "general_note"]
Intent = Literal[
    "record_care_event",
    "create_schedule",
    "update_schedule",
    "generate_handoff",
    "view_timeline",
    "unknown",
]
RequestedAction = Literal[
    "create_care_event",
    "create_schedule",
    "update_schedule",
    "generate_handoff",
    "view_timeline",
    "ask_clarification",
    "none",
]


class ExtractedCareDetails(BaseModel):
    symptom: str | None = None
    location: str | None = None
    severity: int | None = Field(default=None, ge=0, le=10)
    onset: str | None = None
    food: str | None = None
    amount: str | None = None
    medication_name: str | None = None
    activity: str | None = None
    duration: str | None = None
    value: str | None = None
    unit: str | None = None
    note: str | None = None
    model_config = ConfigDict(extra="forbid")


class ExtractedCareEvent(BaseModel):
    category: Category
    event_time: LocalDateTime
    title: str
    details: ExtractedCareDetails
    status: str = "completed"
    model_config = ConfigDict(extra="forbid")


class ExtractedScheduleItem(BaseModel):
    title: str
    start_time: LocalDateTime
    end_time: LocalDateTime | None = None
    assigned_caregiver_id: str | None = None
    status: str = "pending"
    notes: str | None = None
    model_config = ConfigDict(extra="forbid")


class ConversationOutput(BaseModel):
    intent: Intent
    assistant_reply: str
    needs_clarification: bool
    clarification_question: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    care_events: list[ExtractedCareEvent] = Field(default_factory=list)
    schedule_item: ExtractedScheduleItem | None = None
    requested_action: RequestedAction
    model_config = ConfigDict(extra="forbid")


class ChatApprovalDecision(BaseModel):
    approval_id: str
    approved: bool
    care_events: list[ExtractedCareEvent] | None = None


class HandoffSummaryItem(BaseModel):
    text: str
    event_ids: list[str] = Field(default_factory=list)
    schedule_ids: list[str] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class HandoffSummaryOutput(BaseModel):
    completed: list[HandoffSummaryItem] = Field(default_factory=list)
    needs_attention: list[HandoffSummaryItem] = Field(default_factory=list)
    condition_changes: list[HandoffSummaryItem] = Field(default_factory=list)
    upcoming: list[HandoffSummaryItem] = Field(default_factory=list)
    conflicts: list[HandoffSummaryItem] = Field(default_factory=list)
    unconfirmed_information: list[HandoffSummaryItem] = Field(default_factory=list)
    model_config = ConfigDict(extra="forbid")


class CareEventCreate(BaseModel):
    care_recipient_id: str
    caregiver_id: str
    category: Category
    event_time: LocalDateTime
    title: str
    details_json: dict[str, Any] = Field(default_factory=dict)
    status: str = "completed"
    source_type: str = "text"
    raw_input: str | None = None
    attachment_id: str | None = None
    confirmed_by_user: bool = True


class CareEventUpdate(BaseModel):
    category: Category | None = None
    event_time: LocalDateTime | None = None
    title: str | None = None
    details_json: dict[str, Any] | None = None
    status: str | None = None
    caregiver_id: str | None = None


class CareEventRead(CareEventCreate):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ScheduleCreate(BaseModel):
    care_recipient_id: str
    title: str
    start_time: LocalDateTime
    end_time: LocalDateTime | None = None
    assigned_caregiver_id: str | None = None
    status: str = "pending"
    notes: str | None = None
    created_by: str
    force: bool = False


class ScheduleUpdate(BaseModel):
    title: str | None = None
    start_time: LocalDateTime | None = None
    end_time: LocalDateTime | None = None
    assigned_caregiver_id: str | None = None
    status: str | None = None
    notes: str | None = None


class ScheduleRead(BaseModel):
    id: str
    care_recipient_id: str
    title: str
    start_time: datetime
    end_time: datetime | None
    assigned_caregiver_id: str | None
    status: str
    notes: str | None
    created_by: str
    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    care_recipient_id: str
    caregiver_id: str
    conversation_id: str
    message: str = Field(min_length=1)
    attachment_ids: list[str] = Field(default_factory=list)
    # Deliberately keeps its timezone: this value goes into the agent prompt as the
    # reference for relative dates. Strip the offset and the model assumes UTC, so
    # "3 PM" comes back as 23:00. It is never compared against database rows —
    # ExtractedCareEvent/ExtractedScheduleItem normalise whatever the model returns.
    client_time: datetime


class HandoffRequest(BaseModel):
    care_recipient_id: str
    # Field(alias=...) has no effect when assigned onto an Annotated alias like
    # LocalDateTime, so the alias goes inside Annotated instead.
    from_time: Annotated[LocalDateTime, Field(alias="from")]
    to: LocalDateTime
    next_caregiver_id: str
    model_config = ConfigDict(populate_by_name=True)


class CareBoardResponse(BaseModel):
    date: date
    events: list[CareEventRead]
    schedule_items: list[ScheduleRead]
    conflicts: list[dict[str, Any]]
    current_caregiver: dict[str, str]
    next_caregiver: dict[str, str]

