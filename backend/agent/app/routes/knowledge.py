from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, Text
from uuid import UUID
from typing import List, Optional

from app.core.db import get_db
from app.core.models import KnowledgeChunk

router = APIRouter(prefix="/v1/knowledge", tags=["knowledge"])


@router.post("")
def create_chunk(payload: dict, db: Session = Depends(get_db)):
    """Create a new knowledge chunk"""
    tenant_id = payload.get("tenant_id")
    title = payload.get("title")
    content = payload.get("content")
    tags = payload.get("tags", [])

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    if not content:
        raise HTTPException(status_code=400, detail="content required")

    chunk = KnowledgeChunk(
        tenant_id=tenant_id,
        title=title,
        content=content,
        tags=tags
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)

    return {
        "id": str(chunk.id),
        "tenant_id": chunk.tenant_id,
        "title": chunk.title,
        "content": chunk.content,
        "tags": chunk.tags,
        "created_at": chunk.created_at.isoformat() if chunk.created_at else None
    }


@router.get("")
def list_chunks(
    tenant_id: str = Query(..., description="Tenant ID to filter by"),
    db: Session = Depends(get_db)
):
    """List all knowledge chunks for a tenant"""
    chunks = db.query(KnowledgeChunk).filter_by(tenant_id=tenant_id).all()

    return {
        "tenant_id": tenant_id,
        "count": len(chunks),
        "chunks": [
            {
                "id": str(c.id),
                "title": c.title,
                "content": c.content,
                "tags": c.tags,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in chunks
        ]
    }


@router.get("/search")
def search_chunks(
    tenant_id: str = Query(..., description="Tenant ID"),
    keyword: str = Query(..., description="Keyword to search for"),
    db: Session = Depends(get_db)
):
    """
    Search knowledge chunks by keyword.
    Searches in: title, content, and tags (JSONB array).
    """
    keyword_lower = keyword.lower()

    # Search in title, content, or tags array (with partial text match in tags)
    chunks = db.query(KnowledgeChunk).filter(
        KnowledgeChunk.tenant_id == tenant_id,
        or_(
            func.lower(KnowledgeChunk.title).contains(keyword_lower),
            func.lower(KnowledgeChunk.content).contains(keyword_lower),
            # Search in JSONB tags - cast to text for partial match
            func.lower(func.cast(KnowledgeChunk.tags, Text)).contains(keyword_lower),
        )
    ).all()

    return {
        "tenant_id": tenant_id,
        "keyword": keyword,
        "count": len(chunks),
        "results": [
            {
                "id": str(c.id),
                "title": c.title,
                "content": c.content,
                "tags": c.tags,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in chunks
        ]
    }


@router.get("/{chunk_id}")
def get_chunk(chunk_id: UUID, db: Session = Depends(get_db)):
    """Get a specific knowledge chunk by ID"""
    chunk = db.query(KnowledgeChunk).filter_by(id=chunk_id).first()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")

    return {
        "id": str(chunk.id),
        "tenant_id": chunk.tenant_id,
        "title": chunk.title,
        "content": chunk.content,
        "tags": chunk.tags,
        "created_at": chunk.created_at.isoformat() if chunk.created_at else None
    }


@router.delete("/{chunk_id}")
def delete_chunk(chunk_id: UUID, db: Session = Depends(get_db)):
    """Delete a knowledge chunk"""
    chunk = db.query(KnowledgeChunk).filter_by(id=chunk_id).first()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")

    db.delete(chunk)
    db.commit()

    return {"status": "deleted", "id": str(chunk_id)}
