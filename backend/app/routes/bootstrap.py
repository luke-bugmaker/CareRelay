from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Caregiver

router = APIRouter(prefix="/bootstrap", tags=["bootstrap"])


@router.get("")
def bootstrap(db: Session = Depends(get_db)):
    caregivers = db.scalars(select(Caregiver).order_by(Caregiver.name)).all()
    current_id = caregivers[0].id if caregivers else None
    next_id = caregivers[1].id if len(caregivers) > 1 else current_id

    return {
        "care_recipient": {
            "id": "recipient_001",
            "name": "Dad",
            "full_name": "Mr. Lim Wei Ming",
            "age": 78,
            "notes": "Hypertension, mild mobility difficulty",
        },
        "caregivers": [
            {
                "id": caregiver.id,
                "name": caregiver.name,
                "relationship": caregiver.relationship,
            }
            for caregiver in caregivers
        ],
        "shift": {
            "current_caregiver_id": current_id,
            "next_caregiver_id": next_id,
            "shift_ends": datetime.now().replace(
                hour=18, minute=0, second=0, microsecond=0
            ),
        },
    }
