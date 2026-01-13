"""
FastAPI backend for LiveKit agent - JWT token generation and room management
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from models import TokenRequest, TokenResponse, RoomCreateRequest, RoomCreateResponse
from auth import generate_access_token, create_room

# Load environment variables
load_dotenv(os.getenv("ENV_FILE", ".env.local"))

app = FastAPI(
    title="LiveKit Agent API",
    description="API for generating JWT tokens and managing LiveKit rooms",
    version="1.0.0"
)

# CORS configuration - adjust origins for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "LiveKit Agent API",
        "version": "1.0.0"
    }

@app.post("/api/generate-token", response_model=TokenResponse)
async def generate_token(request: TokenRequest):
    """
    Generate JWT token for a participant to join a LiveKit room
    Each user gets a unique room with format: room-{user_id}

    Args:
        request: TokenRequest containing room_name and participant_name

    Returns:
        TokenResponse with JWT token and LiveKit server URL
    """
    try:
        # Generate unique room name per user based on participant name
        # This ensures each user gets their own room with dedicated agent
        unique_room_name = f"room-{request.participant_name}"

        token = generate_access_token(
            room_name=unique_room_name,
            participant_name=request.participant_name,
            metadata=request.metadata
        )

        livekit_url = os.getenv("LIVEKIT_URL", "ws://localhost:7880")

        return TokenResponse(
            token=token,
            url=livekit_url,
            room_name=unique_room_name,
            participant_name=request.participant_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {str(e)}")

@app.post("/api/create-room", response_model=RoomCreateResponse)
async def create_room_endpoint(request: RoomCreateRequest):
    """
    Create a new LiveKit room

    Args:
        request: RoomCreateRequest containing room_name and optional config

    Returns:
        RoomCreateResponse with room details
    """
    try:
        room_info = await create_room(
            room_name=request.room_name,
            empty_timeout=request.empty_timeout,
            max_participants=request.max_participants
        )

        return RoomCreateResponse(
            room_name=room_info["name"],
            sid=room_info["sid"],
            created_at=room_info.get("creation_time", 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Room creation failed: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    livekit_url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")

    return {
        "status": "healthy",
        "livekit_configured": bool(livekit_url and api_key),
        "livekit_url": livekit_url or "not configured"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
