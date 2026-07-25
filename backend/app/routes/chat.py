from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScheduleItem
from ..schemas import (
    CareEventCreate,
    ChatApprovalDecision,
    ChatRequest,
    ExtractedCareEvent,
    ScheduleCreate,
)
from ..services.approval_service import approval_store
from ..services.conflict_store import conflict_store
from ..services.conversation_agent import conversation_agent
from ..tools.check_schedule_conflict import check_schedule_conflict
from ..tools.create_care_event import create_care_event
from ..tools.create_schedule_item import create_schedule_item

router = APIRouter(prefix="/chat", tags=["chat"])


def event_response(event) -> dict:
    return {
        "id": event.id,
        "care_recipient_id": event.care_recipient_id,
        "caregiver_id": event.caregiver_id,
        "category": event.category,
        "event_time": event.event_time.isoformat(),
        "title": event.title,
        "details_json": event.details_json,
        "status": event.status,
        "raw_input": event.raw_input,
        "confirmed_by_user": event.confirmed_by_user,
    }


@router.post("")
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    result = await conversation_agent.run(payload)

    if result.needs_clarification:
        return {
            "status": "clarification_required",
            "assistant_message": result.clarification_question,
            "structured": result.model_dump(mode="json"),
            "created_events": [],
            "created_event_ids": [],
            "clarification_required": True,
            "conflicts": [],
        }

    is_event_write = (
        result.requested_action == "create_care_event"
        and bool(result.care_events)
    )
    is_schedule_write = (
        result.requested_action == "create_schedule"
        and result.schedule_item is not None
    )
    if is_event_write or is_schedule_write:
        approval_id = approval_store.create(payload, result)
        preview_events = [
            {
                "id": f"pending_{approval_id}_{index}",
                "approval_id": approval_id,
                "care_recipient_id": payload.care_recipient_id,
                "caregiver_id": payload.caregiver_id,
                "category": item.category,
                "event_time": item.event_time.isoformat(),
                "title": item.title,
                "details_json": item.details.model_dump(exclude_none=True),
                "status": item.status,
                "raw_input": payload.message,
                "confirmed_by_user": False,
            }
            for index, item in enumerate(result.care_events)
        ]
        preview_schedule = (
            {
                "approval_id": approval_id,
                **result.schedule_item.model_dump(mode="json"),
            }
            if result.schedule_item
            else None
        )
        return {
            "status": "pending_confirmation",
            "assistant_message": "Please confirm before I save this update.",
            "structured": result.model_dump(mode="json"),
            "approval_id": approval_id,
            "preview_events": preview_events,
            "preview_schedule": preview_schedule,
            "created_events": [],
            "created_event_ids": [],
            "created_schedule": None,
            "clarification_required": False,
            "conflicts": [],
        }

    return {
        "status": "no_write_requested",
        "assistant_message": result.assistant_reply,
        "structured": result.model_dump(mode="json"),
        "created_events": [],
        "created_event_ids": [],
        "created_schedule": None,
        "clarification_required": False,
        "conflicts": [],
    }


@router.post("/confirm")
def confirm_chat_action(
    decision: ChatApprovalDecision,
    db: Session = Depends(get_db),
):
    pending = approval_store.take(decision.approval_id)
    if not pending:
        raise HTTPException(404, "Approval request not found or expired")
    if not decision.approved:
        return {
            "status": "rejected",
            "approval_id": decision.approval_id,
            "created_events": [],
            "created_event_ids": [],
            "created_schedule": None,
            "conflicts": [],
        }

    request = pending.request
    output = pending.output
    extracted_events: list[ExtractedCareEvent] = (
        decision.care_events
        if decision.care_events is not None
        else output.care_events
    )
    created_events = []
    if output.requested_action == "create_care_event":
        for item in extracted_events:
            created_events.append(create_care_event(db, CareEventCreate(
                care_recipient_id=request.care_recipient_id,
                caregiver_id=request.caregiver_id,
                category=item.category,
                event_time=item.event_time,
                title=item.title,
                details_json=item.details.model_dump(exclude_none=True),
                status=item.status,
                raw_input=request.message,
                attachment_id=(
                    request.attachment_ids[0]
                    if request.attachment_ids
                    else None
                ),
                confirmed_by_user=True,
            )))

    conflicts = []
    created_schedule = None
    if output.requested_action == "create_schedule" and output.schedule_item:
        schedule_payload = ScheduleCreate(
            care_recipient_id=request.care_recipient_id,
            title=output.schedule_item.title,
            start_time=output.schedule_item.start_time,
            end_time=output.schedule_item.end_time,
            assigned_caregiver_id=output.schedule_item.assigned_caregiver_id,
            status=output.schedule_item.status,
            notes=output.schedule_item.notes,
            created_by=request.caregiver_id,
        )
        conflicts = check_schedule_conflict(db, schedule_payload)
        if conflicts:
            enriched_conflicts = []
            for conflict in conflicts:
                existing = db.get(
                    ScheduleItem, conflict["existing_schedule_id"]
                )
                conflict_id = conflict_store.create(
                    schedule_payload, conflict["existing_schedule_id"]
                )
                enriched_conflicts.append({
                    **conflict,
                    "id": conflict_id,
                    "existing": {
                        "title": existing.title,
                        "start_time": existing.start_time.isoformat(),
                    } if existing else None,
                    "incoming": {
                        "title": schedule_payload.title,
                        "start_time": schedule_payload.start_time.isoformat(),
                    },
                    "resolution_options": [
                        "keep_both",
                        "replace_existing",
                        "edit_new_item",
                    ],
                })
            conflicts = enriched_conflicts
        else:
            created_schedule = create_schedule_item(db, schedule_payload)

    return {
        "status": "confirmation_required" if conflicts else "saved",
        "approval_id": decision.approval_id,
        "created_events": [event_response(event) for event in created_events],
        "created_event_ids": [event.id for event in created_events],
        "created_schedule": (
            {
                "id": created_schedule.id,
                "care_recipient_id": created_schedule.care_recipient_id,
                "title": created_schedule.title,
                "start_time": created_schedule.start_time.isoformat(),
                "end_time": (
                    created_schedule.end_time.isoformat()
                    if created_schedule.end_time
                    else None
                ),
                "status": created_schedule.status,
            }
            if created_schedule
            else None
        ),
        "conflicts": conflicts,
        "resolution_options": (
            ["keep_both", "replace_existing", "edit_new_item"]
            if conflicts
            else []
        ),
    }
