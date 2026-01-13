from sqlalchemy import Column, Text, DateTime, text, ForeignKey, BigInteger, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


# ============== TENANT & AUTH MODELS ==============

class Tenant(Base):
    """Multi-tenant clinic/doctor registration"""
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    clinic_name = Column(Text, nullable=False)
    country = Column(Text, nullable=False)
    timezone = Column(Text, nullable=False, default="Asia/Karachi")
    website = Column(Text)
    clinic_address = Column(Text)
    specialty = Column(Text)  # dentist, ortho, etc.
    allowed_domains = Column(Text)  # comma-separated domains
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base):
    """Doctor/Admin users for each tenant"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    doctor_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, unique=True)
    phone = Column(Text, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(Text, default="admin")  # admin, staff
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Subscription(Base):
    """Subscription/Plan management for tenants"""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True)
    plan = Column(Text, default="FREE")  # FREE, PAID, ENTERPRISE
    is_paid = Column(Boolean, default=False)
    max_placements = Column(Integer, default=5)  # FREE = 5 pages
    paid_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WidgetPlacement(Base):
    """Track widget placements per tenant (FREE plan = max 5 pages)"""
    __tablename__ = "widget_placements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    page_url = Column(Text, nullable=False)  # e.g., /home, /contact, /book
    domain = Column(Text)  # e.g., clinic.com
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ApiKey(Base):
    """API keys for widget embedding (public + secret)"""
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    public_key = Column(Text, nullable=False, unique=True)  # pk_xxxxx (for widget)
    secret_key = Column(Text, nullable=False)  # sk_xxxxx (server-only)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ============== EXISTING MODELS ==============

class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(Text, nullable=False)
    state = Column(Text, nullable=False, default="GREETING")
    collected_data = Column(JSONB, nullable=False, default=dict)
    transcript = Column(Text, nullable=False, default="")
    summary = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SessionFile(Base):
    __tablename__ = "session_files"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id"), nullable=False)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(Text, nullable=False)  # pdf, image, dicom
    file_size = Column(BigInteger, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeChunk(Base):
    """RAG Knowledge Base - stores clinic knowledge chunks for keyword-based retrieval"""
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(Text, nullable=False, index=True)  # clinic identifier
    title = Column(Text, nullable=False)  # chunk title/heading
    content = Column(Text, nullable=False)  # actual knowledge content
    tags = Column(JSONB, default=list)  # keywords for search: ["root canal", "pain", "treatment"]
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FollowUp(Base):
    """CRM - Follow-up tracking for calls"""
    __tablename__ = "follow_ups"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(Text)
    user_name = Column(Text)
    user_phone = Column(Text)
    reason = Column(Text)
    scheduled_date = Column(DateTime(timezone=True))
    status = Column(Text, default="pending")  # pending, sent, responded, no_response
    response_date = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Meeting(Base):
    """CRM - Meeting/Appointment scheduling"""
    __tablename__ = "meetings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(Text)
    user_name = Column(Text)
    user_phone = Column(Text)
    meeting_date = Column(DateTime(timezone=True))
    meeting_time = Column(Text)
    purpose = Column(Text)
    status = Column(Text, default="scheduled")  # scheduled, completed, cancelled, no_show
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
