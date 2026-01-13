"""
CRM API Routes - Dashboard stats, Follow-ups, Meetings, Calls
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.core.db import get_db
from app.core.models import ConversationSession, FollowUp, Meeting

router = APIRouter(prefix="/api/crm", tags=["CRM"])


# ==================== Pydantic Models ====================

class CRMStats(BaseModel):
    total_calls: int
    total_followups: int
    followups_pending: int
    followups_responded: int
    response_rate: float
    total_meetings: int
    meetings_scheduled: int
    meetings_completed: int

class CallSummary(BaseModel):
    id: str
    user_name: Optional[str]
    user_phone: Optional[str]
    state: str
    created_at: datetime
    duration: Optional[int] = None

class FollowUpCreate(BaseModel):
    session_id: Optional[str] = None
    user_name: str
    user_phone: str
    reason: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None

class FollowUpUpdate(BaseModel):
    status: Optional[str] = None  # pending, sent, responded, no_response
    response_date: Optional[datetime] = None
    notes: Optional[str] = None

class FollowUpResponse(BaseModel):
    id: int
    session_id: Optional[str]
    user_name: Optional[str]
    user_phone: Optional[str]
    reason: Optional[str]
    scheduled_date: Optional[datetime]
    status: str
    response_date: Optional[datetime]
    notes: Optional[str]
    created_at: datetime

class MeetingCreate(BaseModel):
    session_id: Optional[str] = None
    user_name: str
    user_phone: str
    meeting_date: date
    meeting_time: str
    purpose: Optional[str] = None
    notes: Optional[str] = None

class MeetingUpdate(BaseModel):
    status: Optional[str] = None  # scheduled, completed, cancelled, no_show
    meeting_date: Optional[date] = None
    meeting_time: Optional[str] = None
    notes: Optional[str] = None

class MeetingResponse(BaseModel):
    id: int
    session_id: Optional[str]
    user_name: Optional[str]
    user_phone: Optional[str]
    meeting_date: Optional[date]
    meeting_time: Optional[str]
    purpose: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime


# ==================== CRM Stats ====================

@router.get("/stats", response_model=CRMStats)
def get_crm_stats(db: Session = Depends(get_db)):
    """Get CRM dashboard statistics"""

    # Total calls
    total_calls = db.query(func.count(ConversationSession.id)).scalar() or 0

    # Follow-ups stats
    total_followups = db.query(func.count(FollowUp.id)).scalar() or 0
    followups_pending = db.query(func.count(FollowUp.id)).filter(FollowUp.status == "pending").scalar() or 0
    followups_responded = db.query(func.count(FollowUp.id)).filter(FollowUp.status == "responded").scalar() or 0

    # Response rate
    response_rate = (followups_responded / total_followups * 100) if total_followups > 0 else 0

    # Meetings stats
    total_meetings = db.query(func.count(Meeting.id)).scalar() or 0
    meetings_scheduled = db.query(func.count(Meeting.id)).filter(Meeting.status == "scheduled").scalar() or 0
    meetings_completed = db.query(func.count(Meeting.id)).filter(Meeting.status == "completed").scalar() or 0

    return CRMStats(
        total_calls=total_calls,
        total_followups=total_followups,
        followups_pending=followups_pending,
        followups_responded=followups_responded,
        response_rate=round(response_rate, 1),
        total_meetings=total_meetings,
        meetings_scheduled=meetings_scheduled,
        meetings_completed=meetings_completed
    )


# ==================== Calls ====================

@router.get("/calls")
def get_all_calls(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get all call logs with pagination"""

    calls = db.query(ConversationSession).order_by(
        desc(ConversationSession.created_at)
    ).offset(offset).limit(limit).all()

    result = []
    for call in calls:
        collected = call.collected_data or {}
        result.append({
            "id": str(call.id),
            "user_name": collected.get("full_name"),
            "user_phone": collected.get("phone"),
            "state": call.state,
            "created_at": call.created_at,
            "transcript": call.transcript[:200] + "..." if call.transcript and len(call.transcript) > 200 else call.transcript
        })

    total = db.query(func.count(ConversationSession.id)).scalar()

    return {
        "calls": result,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/calls/{call_id}")
def get_call_details(call_id: str, db: Session = Depends(get_db)):
    """Get single call details with full transcript"""

    call = db.query(ConversationSession).filter(
        ConversationSession.id == call_id
    ).first()

    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    collected = call.collected_data or {}

    return {
        "id": str(call.id),
        "user_name": collected.get("full_name"),
        "user_phone": collected.get("phone"),
        "state": call.state,
        "collected_data": collected,
        "transcript": call.transcript,
        "summary": call.summary,
        "created_at": call.created_at,
        "updated_at": call.updated_at
    }


# ==================== Follow-ups ====================

@router.get("/follow-ups")
def get_all_followups(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get all follow-ups with optional status filter"""

    query = db.query(FollowUp)

    if status:
        query = query.filter(FollowUp.status == status)

    followups = query.order_by(desc(FollowUp.created_at)).offset(offset).limit(limit).all()

    result = []
    for f in followups:
        result.append({
            "id": f.id,
            "session_id": f.session_id,
            "user_name": f.user_name,
            "user_phone": f.user_phone,
            "reason": f.reason,
            "scheduled_date": f.scheduled_date,
            "status": f.status,
            "response_date": f.response_date,
            "notes": f.notes,
            "created_at": f.created_at
        })

    total = db.query(func.count(FollowUp.id))
    if status:
        total = total.filter(FollowUp.status == status)
    total = total.scalar()

    return {
        "follow_ups": result,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/follow-ups")
def create_followup(data: FollowUpCreate, db: Session = Depends(get_db)):
    """Create a new follow-up entry"""

    followup = FollowUp(
        session_id=data.session_id,
        user_name=data.user_name,
        user_phone=data.user_phone,
        reason=data.reason,
        scheduled_date=data.scheduled_date,
        notes=data.notes,
        status="pending"
    )

    db.add(followup)
    db.commit()
    db.refresh(followup)

    return {
        "id": followup.id,
        "message": "Follow-up created successfully",
        "status": followup.status
    }


@router.put("/follow-ups/{followup_id}")
def update_followup(
    followup_id: int,
    data: FollowUpUpdate,
    db: Session = Depends(get_db)
):
    """Update follow-up status"""

    followup = db.query(FollowUp).filter(FollowUp.id == followup_id).first()

    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    if data.status:
        followup.status = data.status
    if data.response_date:
        followup.response_date = data.response_date
    if data.notes:
        followup.notes = data.notes

    db.commit()

    return {
        "id": followup.id,
        "message": "Follow-up updated successfully",
        "status": followup.status
    }


# ==================== Meetings ====================

@router.get("/meetings")
def get_all_meetings(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get all meetings with optional status filter"""

    query = db.query(Meeting)

    if status:
        query = query.filter(Meeting.status == status)

    meetings = query.order_by(desc(Meeting.created_at)).offset(offset).limit(limit).all()

    result = []
    for m in meetings:
        result.append({
            "id": m.id,
            "session_id": m.session_id,
            "user_name": m.user_name,
            "user_phone": m.user_phone,
            "meeting_date": m.meeting_date,
            "meeting_time": m.meeting_time,
            "purpose": m.purpose,
            "status": m.status,
            "notes": m.notes,
            "created_at": m.created_at
        })

    total = db.query(func.count(Meeting.id))
    if status:
        total = total.filter(Meeting.status == status)
    total = total.scalar()

    return {
        "meetings": result,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/meetings")
def create_meeting(data: MeetingCreate, db: Session = Depends(get_db)):
    """Schedule a new meeting"""

    meeting = Meeting(
        session_id=data.session_id,
        user_name=data.user_name,
        user_phone=data.user_phone,
        meeting_date=data.meeting_date,
        meeting_time=data.meeting_time,
        purpose=data.purpose,
        notes=data.notes,
        status="scheduled"
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return {
        "id": meeting.id,
        "message": "Meeting scheduled successfully",
        "status": meeting.status
    }


@router.put("/meetings/{meeting_id}")
def update_meeting(
    meeting_id: int,
    data: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Update meeting details/status"""

    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if data.status:
        meeting.status = data.status
    if data.meeting_date:
        meeting.meeting_date = data.meeting_date
    if data.meeting_time:
        meeting.meeting_time = data.meeting_time
    if data.notes:
        meeting.notes = data.notes

    db.commit()

    return {
        "id": meeting.id,
        "message": "Meeting updated successfully",
        "status": meeting.status
    }
