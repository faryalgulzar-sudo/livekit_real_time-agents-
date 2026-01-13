from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.routes.sessions import router as sessions_router
from app.routes.knowledge import router as knowledge_router
from app.routes.kb_ingest import router as kb_ingest_router
from app.routes.crm import router as crm_router
from app.routes.auth import router as auth_router
from app.routes.widget import router as widget_router
from app.core.db import engine
from app.core.models import Base
import os
from livekit import api
from pydantic import BaseModel
from typing import Optional


app = FastAPI(title="Dentist Voice Agent API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for token endpoint
class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    metadata: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    url: str
    room_name: str
    participant_name: str

# Create database tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

app.include_router(sessions_router)
app.include_router(knowledge_router)
app.include_router(kb_ingest_router)
app.include_router(crm_router)
app.include_router(auth_router)
app.include_router(widget_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/generate-token", response_model=TokenResponse)
async def generate_token(request: TokenRequest):
    """Generate JWT token for LiveKit room access"""
    try:
        # Get credentials from environment
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        # Use public URL for frontend (browser)
        livekit_url = os.getenv("LIVEKIT_PUBLIC_URL", "wss://livekit.drap.ai")

        if not api_key or not api_secret:
            raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

        # Create unique room name per user
        unique_room_name = f"room-{request.participant_name}"

        # Create access token
        token = api.AccessToken(api_key, api_secret)
        token.with_identity(request.participant_name)
        token.with_name(request.participant_name)

        if request.metadata:
            token.with_metadata(request.metadata)

        # Grant permissions
        token.with_grants(
            api.VideoGrants(
                room_join=True,
                room=unique_room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )

        # Generate JWT
        jwt_token = token.to_jwt()

        return TokenResponse(
            token=jwt_token,
            url=livekit_url,
            room_name=unique_room_name,
            participant_name=request.participant_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")
