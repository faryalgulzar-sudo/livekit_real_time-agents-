"""
Authentication Routes - Signup, Login, Me
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
import jwt
import os
import hashlib

from app.core.db import get_db
from app.core.models import Tenant, User, Subscription, ApiKey

router = APIRouter(prefix="/auth", tags=["Auth"])

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()


# ============== SCHEMAS ==============

class SignupRequest(BaseModel):
    clinic_name: str
    doctor_name: str
    email: EmailStr
    phone: str
    password: str
    country: str
    timezone: str = "Asia/Karachi"
    website: str | None = None
    clinic_address: str | None = None
    specialty: str | None = None
    allowed_domains: str | None = None
    agree_terms: bool


class SignupResponse(BaseModel):
    success: bool
    message: str
    tenant_id: str
    public_key: str
    plan: str
    free_limit_pages: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    success: bool
    access_token: str
    token_type: str
    user: dict


class MeResponse(BaseModel):
    user_id: str
    tenant_id: str
    doctor_name: str
    email: str
    clinic_name: str
    plan: str
    is_paid: bool
    public_key: str


# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    """Hash password using SHA256 with salt"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${password_hash}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, stored_hash = hashed_password.split('$')
        password_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return password_hash == stored_hash
    except ValueError:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ============== ROUTES ==============

@router.post("/signup", response_model=SignupResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Register a new clinic/doctor account.
    Creates: tenant, user, subscription, api_keys
    """
    # Validate
    if not payload.agree_terms:
        raise HTTPException(status_code=400, detail="You must accept Terms & Conditions")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        # 1. Create Tenant
        tenant = Tenant(
            clinic_name=payload.clinic_name,
            country=payload.country,
            timezone=payload.timezone,
            website=payload.website,
            clinic_address=payload.clinic_address,
            specialty=payload.specialty,
            allowed_domains=payload.allowed_domains,
            is_active=True
        )
        db.add(tenant)
        db.flush()  # Get tenant.id

        # 2. Create User
        user = User(
            tenant_id=tenant.id,
            doctor_name=payload.doctor_name,
            email=payload.email,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            role="admin",
            is_active=True
        )
        db.add(user)

        # 3. Create Subscription (FREE plan)
        subscription = Subscription(
            tenant_id=tenant.id,
            plan="FREE",
            is_paid=False,
            max_placements=5  # FREE = 5 pages
        )
        db.add(subscription)

        # 4. Generate API Keys
        public_key = "pk_" + secrets.token_urlsafe(16)
        secret_key = "sk_" + secrets.token_urlsafe(32)

        api_key = ApiKey(
            tenant_id=tenant.id,
            public_key=public_key,
            secret_key=secret_key,
            revoked=False
        )
        db.add(api_key)

        # Commit all
        db.commit()

        return SignupResponse(
            success=True,
            message="Account created successfully! You can now login.",
            tenant_id=str(tenant.id),
            public_key=public_key,
            plan="FREE",
            free_limit_pages=5
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password.
    Returns JWT token for authentication.
    """
    # Find user
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if user is active
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Get tenant info
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

    # Create JWT token
    access_token = create_access_token({
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id),
        "email": user.email,
        "role": user.role
    })

    return LoginResponse(
        success=True,
        access_token=access_token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "doctor_name": user.doctor_name,
            "email": user.email,
            "clinic_name": tenant.clinic_name if tenant else "",
            "role": user.role
        }
    )


@router.get("/me", response_model=MeResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current logged-in user info.
    Requires: Bearer token in Authorization header.
    """
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()

    # Get subscription
    subscription = db.query(Subscription).filter(
        Subscription.tenant_id == current_user.tenant_id
    ).first()

    # Get API key
    api_key = db.query(ApiKey).filter(
        ApiKey.tenant_id == current_user.tenant_id,
        ApiKey.revoked == False
    ).first()

    return MeResponse(
        user_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id),
        doctor_name=current_user.doctor_name,
        email=current_user.email,
        clinic_name=tenant.clinic_name if tenant else "",
        plan=subscription.plan if subscription else "FREE",
        is_paid=subscription.is_paid if subscription else False,
        public_key=api_key.public_key if api_key else ""
    )
