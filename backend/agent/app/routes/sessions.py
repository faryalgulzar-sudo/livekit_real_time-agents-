from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from uuid import UUID
import os
import shutil
from datetime import datetime

from app.core.db import get_db
from app.core.models import ConversationSession, SessionFile

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])

# Upload directory for files
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("")
def create_session(payload: dict, db: Session = Depends(get_db)):
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")

    session = ConversationSession(
        tenant_id=tenant_id,
        state="GREETING",
        collected_data={},
        transcript=""
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": session.id}


@router.post("/{session_id}/answers")
def save_answer(session_id: UUID, payload: dict, db: Session = Depends(get_db)):
    field = payload.get("field")
    value = payload.get("value")

    if not field:
        raise HTTPException(status_code=400, detail="field required")

    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Create new dict to force SQLAlchemy to detect change
    data = dict(session.collected_data) if session.collected_data else {}
    data[field] = value
    session.collected_data = data

    # Force SQLAlchemy to detect JSONB change
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(session, "collected_data")

    db.commit()
    return {"status": "saved"}


@router.post("/{session_id}/transcript")
def append_transcript(session_id: UUID, payload: dict, db: Session = Depends(get_db)):
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="text required")

    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.transcript += f"\n{text}"
    db.commit()

    return {"status": "appended"}


@router.get("/{session_id}")
def get_session(session_id: UUID, db: Session = Depends(get_db)):
    """Get session details including collected_data"""
    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": str(session.id),
        "tenant_id": session.tenant_id,
        "state": session.state,
        "collected_data": session.collected_data or {},
        "created_at": session.created_at.isoformat() if session.created_at else None
    }


@router.post("/{session_id}/files")
async def upload_file(session_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a report/X-ray file for a session"""

    # Check if session exists
    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/dicom", "application/dicom"]
    if file.content_type not in allowed_types and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.content_type}")

    # Create session-specific upload directory
    session_upload_dir = os.path.join(UPLOAD_DIR, str(session_id))
    os.makedirs(session_upload_dir, exist_ok=True)

    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(session_upload_dir, safe_filename)

    # Save file to disk
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            file_size = len(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Determine file type
    if file.content_type == "application/pdf":
        file_type = "pdf"
    elif "dicom" in file.content_type.lower():
        file_type = "dicom"
    else:
        file_type = "image"

    # Save file record to database
    session_file = SessionFile(
        session_id=session_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size
    )
    db.add(session_file)
    db.flush()  # Get the ID before commit

    # Update collected_data with files_uploaded flag
    data = dict(session.collected_data) if session.collected_data else {}
    data["files_uploaded"] = True
    if "uploaded_files" not in data:
        data["uploaded_files"] = []
    data["uploaded_files"].append({
        "file_id": str(session_file.id),
        "file_name": file.filename,
        "file_type": file_type,
        "file_size": file_size
    })
    session.collected_data = data

    # Force SQLAlchemy to detect JSONB change
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(session, "collected_data")

    db.commit()
    db.refresh(session_file)

    return {
        "status": "uploaded",
        "file_id": str(session_file.id),
        "file_name": file.filename,
        "file_type": file_type,
        "file_size": file_size,
        "files_uploaded": True
    }


@router.get("/{session_id}/files")
def get_session_files(session_id: UUID, db: Session = Depends(get_db)):
    """Get all uploaded files for a session"""
    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    files = db.query(SessionFile).filter_by(session_id=session_id).all()

    return {
        "session_id": str(session_id),
        "files": [
            {
                "file_id": str(f.id),
                "file_name": f.file_name,
                "file_type": f.file_type,
                "file_size": f.file_size,
                "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None
            }
            for f in files
        ]
    }
