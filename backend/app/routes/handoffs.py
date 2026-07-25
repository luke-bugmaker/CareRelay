from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import HandoffRequest
from ..services.handoff_agent import handoff_agent
from ..services.handoff_service import build_handoff, get_handoff_records

router = APIRouter(prefix="/handoffs", tags=["handoffs"])


@router.post("/generate")
async def generate_handoff(payload: HandoffRequest, db: Session = Depends(get_db)):
    records = get_handoff_records(
        db,
        payload.care_recipient_id,
        payload.from_time,
        payload.to,
    )
    if handoff_agent.configured:
        summary = (await handoff_agent.run(records)).model_dump(mode="json")
        generated_by = "ai"
    else:
        summary = build_handoff(
            db,
            payload.care_recipient_id,
            payload.from_time,
            payload.to,
        )
        generated_by = "local_fallback"

    return {
        **summary,
        "next_caregiver_id": payload.next_caregiver_id,
        "next_caregiver": {"id": payload.next_caregiver_id},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": generated_by,
    }

