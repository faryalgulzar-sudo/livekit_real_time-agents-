from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from datetime import datetime

from app.core.db import get_db
from app.core.models import ConversationSession

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


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

    data = session.collected_data or {}
    data[field] = value
    session.collected_data = data

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


@router.patch("/{session_id}/finalize")
def finalize_session(session_id: UUID, db: Session = Depends(get_db)):
    """
    Mark session as completed and set final state.
    Called during agent cleanup to properly close the session.
    """
    session = db.query(ConversationSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update session state to COMPLETED
    session.state = "COMPLETED"
    session.updated_at = datetime.utcnow()

    db.commit()

    return {
        "status": "finalized",
        "session_id": str(session.id),
        "final_state": session.state,
        "finalized_at": session.updated_at.isoformat()
    }
