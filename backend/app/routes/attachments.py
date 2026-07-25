from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Attachment, new_id

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("", status_code=201)
async def upload_attachment(uploaded_by: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    attachment_id = new_id("attachment")
    suffix = Path(file.filename or "").suffix.lower()
    destination = settings.upload_dir / f"{attachment_id}{suffix}"
    destination.write_bytes(await file.read())
    media_type = "image" if (file.content_type or "").startswith("image/") else "voice" if (file.content_type or "").startswith("audio/") else "file"
    attachment = Attachment(id=attachment_id, file_type=media_type, file_url=f"/uploads/{destination.name}", uploaded_by=uploaded_by)
    db.add(attachment)
    db.commit()
    return {"attachment_id": attachment.id, "type": attachment.file_type, "file_url": attachment.file_url}

