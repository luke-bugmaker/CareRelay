import asyncio
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import CareEvent
from app.routes.chat import chat, confirm_chat_action
from app.schemas import ChatApprovalDecision, ChatRequest, ConversationOutput
from app.services.conversation_agent import ConversationAgent, conversation_agent


def make_request(message: str) -> ChatRequest:
    return ChatRequest(
        care_recipient_id="recipient_001",
        caregiver_id="caregiver_amy",
        conversation_id="conversation_001",
        message=message,
        client_time=datetime(2026, 7, 24, 12, 5, tzinfo=timezone.utc),
    )


def test_conversation_output_parses_typed_details():
    output = ConversationOutput.model_validate({
        "intent": "record_care_event",
        "assistant_reply": "Recorded.",
        "needs_clarification": False,
        "missing_fields": [],
        "care_events": [{
            "category": "hydration",
            "event_time": "2026-07-24T12:00:00Z",
            "title": "Water",
            "details": {"amount": "one glass"},
            "status": "completed",
        }],
        "schedule_item": None,
        "requested_action": "create_care_event",
    })

    assert output.care_events[0].details.amount == "one glass"


def test_local_fallback_returns_typed_output():
    output = ConversationAgent()._local_demo_parse(make_request("Dad drank water."))

    assert isinstance(output, ConversationOutput)
    assert output.requested_action == "create_care_event"
    assert output.care_events[0].category == "hydration"


def test_write_waits_for_confirmation(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'approval.db'}")
    Base.metadata.create_all(engine)
    request = make_request("Dad drank water.")
    output = ConversationAgent()._local_demo_parse(request)

    async def fake_run(_request):
        return output

    monkeypatch.setattr(conversation_agent, "run", fake_run)

    with Session(engine) as db:
        preview = asyncio.run(chat(request, db))
        assert preview["status"] == "pending_confirmation"
        assert db.scalar(select(CareEvent)) is None

        saved = confirm_chat_action(
            ChatApprovalDecision(
                approval_id=preview["approval_id"],
                approved=True,
            ),
            db,
        )
        assert saved["status"] == "saved"
        assert db.scalar(select(CareEvent)) is not None


def test_rejected_write_is_not_saved(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'rejected.db'}")
    Base.metadata.create_all(engine)
    request = make_request("Dad drank water.")
    output = ConversationAgent()._local_demo_parse(request)

    async def fake_run(_request):
        return output

    monkeypatch.setattr(conversation_agent, "run", fake_run)

    with Session(engine) as db:
        preview = asyncio.run(chat(request, db))
        rejected = confirm_chat_action(
            ChatApprovalDecision(
                approval_id=preview["approval_id"],
                approved=False,
            ),
            db,
        )
        assert rejected["status"] == "rejected"
        assert db.scalar(select(CareEvent)) is None
