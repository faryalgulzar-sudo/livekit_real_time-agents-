"""
Knowledge Base Ingest Endpoint
------------------------------
POST /v1/kb/ingest - Bulk ingest clinic knowledge

Admin pastes structured content (agency info, timings, pricing, services, etc.)
Backend splits into chunks, extracts keywords, stores in knowledge_chunks table.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import re

from app.core.db import get_db
from app.core.models import KnowledgeChunk

router = APIRouter(prefix="/v1/kb", tags=["knowledge-base"])


# Common dental/clinic keywords for auto-tagging
DENTAL_KEYWORDS = {
    # Treatments
    "root canal", "filling", "extraction", "crown", "bridge", "implant",
    "denture", "whitening", "cleaning", "scaling", "braces", "invisalign",
    "veneer", "bonding", "sealant", "fluoride", "x-ray", "xray",

    # Conditions
    "cavity", "decay", "pain", "toothache", "gum", "bleeding", "swelling",
    "sensitivity", "infection", "abscess", "wisdom tooth",

    # General
    "appointment", "emergency", "consultation", "checkup", "treatment",
    "cost", "price", "fee", "payment", "insurance", "discount",
    "timing", "hours", "schedule", "location", "address", "parking",
    "doctor", "dentist", "specialist", "clinic", "hospital",

    # Urdu keywords
    "dard", "dant", "masoor", "safai", "ilaj", "fees", "waqt"
}


def extract_keywords(text: str) -> List[str]:
    """Extract relevant keywords from text content"""
    text_lower = text.lower()
    found_keywords = []

    for keyword in DENTAL_KEYWORDS:
        if keyword in text_lower:
            found_keywords.append(keyword)

    return list(set(found_keywords))


def split_into_chunks(content: str, category: str) -> List[Dict[str, str]]:
    """
    Split content into logical chunks based on structure.
    Handles:
    - Paragraph breaks (double newline)
    - Numbered lists
    - Bullet points
    - Section headers
    """
    chunks = []

    # If content has clear sections (lines starting with headers/numbers)
    lines = content.strip().split('\n')
    current_chunk = []
    current_title = category

    for line in lines:
        line = line.strip()
        if not line:
            # Empty line - might be section break
            if current_chunk:
                chunk_content = '\n'.join(current_chunk)
                if chunk_content.strip():
                    chunks.append({
                        "title": current_title,
                        "content": chunk_content.strip()
                    })
                current_chunk = []
            continue

        # Check if line is a header/title (ends with : or is ALL CAPS or starts with #)
        is_header = (
            line.endswith(':') or
            line.isupper() or
            line.startswith('#') or
            line.startswith('**') and line.endswith('**')
        )

        if is_header:
            # Save previous chunk
            if current_chunk:
                chunk_content = '\n'.join(current_chunk)
                if chunk_content.strip():
                    chunks.append({
                        "title": current_title,
                        "content": chunk_content.strip()
                    })
                current_chunk = []

            # Clean title
            current_title = line.strip(':').strip('#').strip('*').strip()
            if not current_title:
                current_title = category
        else:
            current_chunk.append(line)

    # Don't forget last chunk
    if current_chunk:
        chunk_content = '\n'.join(current_chunk)
        if chunk_content.strip():
            chunks.append({
                "title": current_title,
                "content": chunk_content.strip()
            })

    # If no chunks created, treat entire content as one chunk
    if not chunks and content.strip():
        chunks.append({
            "title": category,
            "content": content.strip()
        })

    return chunks


@router.post("/ingest")
def ingest_knowledge(payload: dict, db: Session = Depends(get_db)):
    """
    Ingest clinic knowledge base content.

    Expected payload:
    {
        "tenant_id": "demo_clinic",
        "category": "services",  // services, timings, pricing, location, policies, faq
        "content": "... raw text content ...",
        "extra_tags": ["optional", "custom", "tags"]  // optional
    }

    The endpoint will:
    1. Split content into logical chunks
    2. Auto-extract keywords/tags from each chunk
    3. Store chunks in knowledge_chunks table
    """
    tenant_id = payload.get("tenant_id")
    category = payload.get("category", "general")
    content = payload.get("content", "")
    extra_tags = payload.get("extra_tags", [])

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="content required")

    # Split content into chunks
    chunks_data = split_into_chunks(content, category)

    created_chunks = []

    for chunk_data in chunks_data:
        # Extract keywords from this chunk
        auto_tags = extract_keywords(chunk_data["content"])

        # Combine: category + auto-extracted + user-provided tags
        all_tags = list(set([category] + auto_tags + extra_tags))

        # Create chunk in DB
        chunk = KnowledgeChunk(
            tenant_id=tenant_id,
            title=chunk_data["title"],
            content=chunk_data["content"],
            tags=all_tags
        )
        db.add(chunk)
        db.flush()  # Get ID

        created_chunks.append({
            "id": str(chunk.id),
            "title": chunk.title,
            "content": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
            "tags": chunk.tags
        })

    db.commit()

    return {
        "status": "ingested",
        "tenant_id": tenant_id,
        "category": category,
        "chunks_created": len(created_chunks),
        "chunks": created_chunks
    }


@router.post("/ingest/bulk")
def ingest_bulk(payload: dict, db: Session = Depends(get_db)):
    """
    Bulk ingest multiple categories at once.

    Expected payload:
    {
        "tenant_id": "demo_clinic",
        "data": {
            "agency_name": "ABC Dental Clinic",
            "timings": "Monday-Friday: 9am-6pm\nSaturday: 10am-2pm\nSunday: Closed",
            "pricing": "Consultation: Rs. 500\nCleaning: Rs. 2000\nFilling: Rs. 3000-5000",
            "services": "General Dentistry\nRoot Canal Treatment\nTeeth Whitening\nBraces & Invisalign",
            "location": "123 Main Street, Lahore\nNear XYZ Hospital\nParking available",
            "policies": "Appointment required\n24hr cancellation policy\nInsurance accepted",
            "faq": "Q: Do you accept walk-ins?\nA: Only for emergencies..."
        }
    }
    """
    tenant_id = payload.get("tenant_id")
    data = payload.get("data", {})

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    if not data:
        raise HTTPException(status_code=400, detail="data required")

    total_chunks = 0
    results = {}

    for category, content in data.items():
        if not content or not str(content).strip():
            continue

        # Split and ingest each category
        chunks_data = split_into_chunks(str(content), category)

        category_chunks = []
        for chunk_data in chunks_data:
            auto_tags = extract_keywords(chunk_data["content"])
            all_tags = list(set([category] + auto_tags))

            chunk = KnowledgeChunk(
                tenant_id=tenant_id,
                title=chunk_data["title"],
                content=chunk_data["content"],
                tags=all_tags
            )
            db.add(chunk)
            db.flush()

            category_chunks.append({
                "id": str(chunk.id),
                "title": chunk.title,
                "tags": chunk.tags
            })

        results[category] = {
            "chunks_created": len(category_chunks),
            "chunks": category_chunks
        }
        total_chunks += len(category_chunks)

    db.commit()

    return {
        "status": "bulk_ingested",
        "tenant_id": tenant_id,
        "total_chunks": total_chunks,
        "categories": results
    }


@router.delete("/clear")
def clear_knowledge(tenant_id: str, db: Session = Depends(get_db)):
    """Clear all knowledge chunks for a tenant (for re-ingestion)"""
    deleted = db.query(KnowledgeChunk).filter_by(tenant_id=tenant_id).delete()
    db.commit()

    return {
        "status": "cleared",
        "tenant_id": tenant_id,
        "chunks_deleted": deleted
    }


# Query synonyms mapping - maps user query terms to DB search terms
QUERY_SYNONYMS = {
    # Pricing related
    "fees": ["pricing", "price", "cost", "fee", "payment", "Rs"],
    "price": ["pricing", "price", "cost", "fee", "Rs"],
    "cost": ["pricing", "price", "cost", "fee", "Rs"],
    "kitna": ["pricing", "price", "cost", "fee", "Rs"],
    "kitne": ["pricing", "price", "cost", "fee", "Rs"],
    "kharcha": ["pricing", "price", "cost", "fee", "Rs"],
    "rate": ["pricing", "price", "cost", "fee", "Rs"],

    # Timing related
    "timing": ["timings", "timing", "hours", "schedule", "open", "close"],
    "timings": ["timings", "timing", "hours", "schedule", "open", "close"],
    "time": ["timings", "timing", "hours", "schedule"],
    "waqt": ["timings", "timing", "hours", "schedule"],
    "kab": ["timings", "timing", "hours", "schedule"],
    "open": ["timings", "timing", "hours", "schedule", "open"],
    "close": ["timings", "timing", "hours", "schedule", "close"],

    # Location related
    "address": ["location", "address", "parking", "landmark"],
    "location": ["location", "address", "parking", "landmark"],
    "kahan": ["location", "address"],
    "jagah": ["location", "address"],
    "where": ["location", "address"],

    # Services related
    "services": ["services", "treatment", "procedure"],
    "treatment": ["services", "treatment", "procedure", "ilaj"],
    "ilaj": ["services", "treatment", "ilaj"],
    "procedure": ["services", "treatment", "procedure"],

    # Emergency
    "emergency": ["emergency", "urgent", "after-hours"],
    "urgent": ["emergency", "urgent"],
    "fori": ["emergency", "urgent"],
}


def expand_query_terms(query: str) -> List[str]:
    """Expand query into search terms including synonyms"""
    query_lower = query.lower()
    terms = set()

    # Add original words
    words = re.findall(r'\w+', query_lower)
    terms.update(words)

    # Add synonyms
    for word in words:
        if word in QUERY_SYNONYMS:
            terms.update(QUERY_SYNONYMS[word])

    return list(terms)


def score_chunk(chunk: KnowledgeChunk, search_terms: List[str]) -> float:
    """
    Score a chunk based on keyword matches.
    Higher score = more relevant.
    """
    score = 0.0
    title_lower = chunk.title.lower()
    content_lower = chunk.content.lower()
    tags_lower = [t.lower() for t in (chunk.tags or [])]

    for term in search_terms:
        term_lower = term.lower()

        # Title match (highest weight)
        if term_lower in title_lower:
            score += 10.0

        # Tag exact match (high weight)
        if term_lower in tags_lower:
            score += 8.0

        # Tag partial match
        for tag in tags_lower:
            if term_lower in tag or tag in term_lower:
                score += 3.0

        # Content match (medium weight)
        # Count occurrences
        occurrences = content_lower.count(term_lower)
        score += min(occurrences * 2.0, 10.0)  # Cap at 10

    return score


@router.post("/query")
def query_knowledge(payload: dict, db: Session = Depends(get_db)):
    """
    Query the knowledge base with natural language.
    Agent calls this when user asks questions like:
    - "fees kya hai?"
    - "timings?"
    - "address?"

    Returns top 3 most relevant chunks.

    Expected payload:
    {
        "tenant_id": "demo_clinic",
        "query": "fees kya hai?",
        "top_k": 3  // optional, default 3
    }
    """
    tenant_id = payload.get("tenant_id")
    query = payload.get("query", "")
    top_k = payload.get("top_k", 3)

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="query required")

    # Expand query into search terms
    search_terms = expand_query_terms(query)

    # Get all chunks for tenant
    all_chunks = db.query(KnowledgeChunk).filter_by(tenant_id=tenant_id).all()

    if not all_chunks:
        return {
            "query": query,
            "search_terms": search_terms,
            "count": 0,
            "results": [],
            "context": ""
        }

    # Score each chunk
    scored_chunks = []
    for chunk in all_chunks:
        score = score_chunk(chunk, search_terms)
        if score > 0:
            scored_chunks.append((chunk, score))

    # Sort by score (highest first)
    scored_chunks.sort(key=lambda x: x[1], reverse=True)

    # Take top K
    top_chunks = scored_chunks[:top_k]

    # Build context string for LLM
    context_parts = []
    results = []

    for chunk, score in top_chunks:
        context_parts.append(f"[{chunk.title}]\n{chunk.content}")
        results.append({
            "id": str(chunk.id),
            "title": chunk.title,
            "content": chunk.content,
            "tags": chunk.tags,
            "score": round(score, 2)
        })

    context = "\n\n---\n\n".join(context_parts)

    return {
        "query": query,
        "search_terms": search_terms,
        "count": len(results),
        "results": results,
        "context": context  # Ready-to-use context for LLM prompt
    }
