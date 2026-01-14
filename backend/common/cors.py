"""
Centralized CORS configuration for all FastAPI applications
"""
import os
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def get_allowed_origins() -> List[str]:
    """
    Get allowed CORS origins from environment with fallback.
    Raises ValueError in production if not configured.
    """
    env_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")

    if env_origins:
        return [origin.strip() for origin in env_origins.split(",") if origin.strip()]

    # Development fallback
    if os.getenv("ENV", "production") == "development":
        return ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://localhost:8080"]

    raise ValueError(
        "CORS_ALLOWED_ORIGINS must be set in production environment. "
        "Example: CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com"
    )


def configure_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for FastAPI application.

    Args:
        app: FastAPI application instance
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=3600,
    )
