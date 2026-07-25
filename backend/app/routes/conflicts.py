from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ScheduleItem
from ..services.conflict_store import conflict_store
from ..tools.create_schedule_item import create_schedule_item

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


class ConflictDecision(BaseModel):
    conflict_id: str
    resolution: Literal["keep_both", "replace_existing", "discard_new"]


@router.post("/resolve")
def resolve_conflict(
    decision: ConflictDecision,
    db: Session = Depends(get_db),
):
    pending = conflict_store.take(decision.conflict_id)
    if not pending:
        raise HTTPException(404, "Conflict request not found or expired")

    if decision.resolution == "discard_new":
        return {
            "status": "resolved",
            "conflict_id": decision.conflict_id,
            "resolution": decision.resolution,
            "schedule_item_id": None,
        }

    if decision.resolution == "replace_existing":
        existing = db.get(ScheduleItem, pending.existing_schedule_id)
        if existing:
            db.delete(existing)
            db.commit()

    created = create_schedule_item(db, pending.schedule)
    return {
        "status": "resolved",
        "conflict_id": decision.conflict_id,
        "resolution": decision.resolution,
        "schedule_item_id": created.id,
    }
