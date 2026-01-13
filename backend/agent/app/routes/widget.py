"""
Widget Routes - Token generation for embedded widget with placement limits
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
import os

from app.core.db import get_db
from app.core.models import Tenant, Subscription, WidgetPlacement, ApiKey

router = APIRouter(prefix="/widget", tags=["Widget"])

# LiveKit settings
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")


# ============== SCHEMAS ==============

class WidgetTokenRequest(BaseModel):
    public_key: str  # pk_xxxxx
    page_url: str    # e.g., /home, /contact
    visitor_id: str | None = None  # optional visitor tracking
    domain: str | None = None  # e.g., clinic.com


class WidgetTokenResponse(BaseModel):
    success: bool
    token: str | None = None
    livekit_url: str | None = None
    tenant_id: str | None = None
    room_name: str | None = None
    error: str | None = None
    upgrade_required: bool = False


class PlacementInfo(BaseModel):
    used: int
    max: int
    pages: list[str]


# ============== ROUTES ==============

@router.post("/token", response_model=WidgetTokenResponse)
def get_widget_token(payload: WidgetTokenRequest, db: Session = Depends(get_db)):
    """
    Generate a LiveKit token for widget embed.

    Flow:
    1. Validate public_key
    2. Check tenant subscription
    3. If FREE plan: check placement limit (max 5 pages)
    4. Generate and return token
    """
    # 1. Find API key and tenant
    api_key = db.query(ApiKey).filter(
        ApiKey.public_key == payload.public_key,
        ApiKey.revoked == False
    ).first()

    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    tenant_id = api_key.tenant_id

    # 2. Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant account is inactive")

    # 3. Check subscription and placement limits
    subscription = db.query(Subscription).filter(
        Subscription.tenant_id == tenant_id
    ).first()

    if not subscription:
        raise HTTPException(status_code=403, detail="No subscription found")

    # Normalize page_url
    page_url = payload.page_url.strip().lower()
    if not page_url.startswith("/"):
        page_url = "/" + page_url

    # Check if FREE plan and need to enforce limits
    if subscription.plan == "FREE" and not subscription.is_paid:
        # Get existing placements
        existing_placements = db.query(WidgetPlacement).filter(
            WidgetPlacement.tenant_id == tenant_id,
            WidgetPlacement.is_active == True
        ).all()

        existing_urls = [p.page_url for p in existing_placements]
        placement_count = len(existing_placements)

        # Check if this page_url is already registered
        if page_url not in existing_urls:
            # New page - check if limit reached
            if placement_count >= subscription.max_placements:
                return WidgetTokenResponse(
                    success=False,
                    error=f"Free plan limit reached. You can only embed the widget on {subscription.max_placements} pages. Please upgrade to add more.",
                    upgrade_required=True
                )

            # Add new placement
            new_placement = WidgetPlacement(
                tenant_id=tenant_id,
                page_url=page_url,
                domain=payload.domain,
                is_active=True
            )
            db.add(new_placement)
            db.commit()

    # 4. Generate LiveKit token
    try:
        from livekit import api

        visitor_id = payload.visitor_id or secrets.token_urlsafe(8)
        room_name = f"room-{visitor_id}"

        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity(f"user_{visitor_id}") \
            .with_name(f"Visitor {visitor_id[:6]}") \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
            ))

        jwt_token = token.to_jwt()

        return WidgetTokenResponse(
            success=True,
            token=jwt_token,
            livekit_url=LIVEKIT_URL,
            tenant_id=str(tenant_id),
            room_name=room_name
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")


@router.get("/placements/{public_key}", response_model=PlacementInfo)
def get_placements(public_key: str, db: Session = Depends(get_db)):
    """
    Get current placement usage for a tenant.
    """
    # Find API key
    api_key = db.query(ApiKey).filter(
        ApiKey.public_key == public_key,
        ApiKey.revoked == False
    ).first()

    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    tenant_id = api_key.tenant_id

    # Get subscription
    subscription = db.query(Subscription).filter(
        Subscription.tenant_id == tenant_id
    ).first()

    # Get placements
    placements = db.query(WidgetPlacement).filter(
        WidgetPlacement.tenant_id == tenant_id,
        WidgetPlacement.is_active == True
    ).all()

    return PlacementInfo(
        used=len(placements),
        max=subscription.max_placements if subscription else 5,
        pages=[p.page_url for p in placements]
    )


@router.delete("/placements/{public_key}/{page_url:path}")
def remove_placement(public_key: str, page_url: str, db: Session = Depends(get_db)):
    """
    Remove a page placement (to free up a slot).
    """
    # Find API key
    api_key = db.query(ApiKey).filter(
        ApiKey.public_key == public_key,
        ApiKey.revoked == False
    ).first()

    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    tenant_id = api_key.tenant_id

    # Normalize page_url
    if not page_url.startswith("/"):
        page_url = "/" + page_url

    # Find and deactivate placement
    placement = db.query(WidgetPlacement).filter(
        WidgetPlacement.tenant_id == tenant_id,
        WidgetPlacement.page_url == page_url,
        WidgetPlacement.is_active == True
    ).first()

    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")

    placement.is_active = False
    db.commit()

    return {"success": True, "message": f"Placement for {page_url} removed"}
