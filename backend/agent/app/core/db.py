import os
import logging
from sqlalchemy import create_engine, event, exc, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import Pool
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

# Connection pool configuration
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))
POOL_PRE_PING = os.getenv("DB_POOL_PRE_PING", "true").lower() == "true"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=POOL_PRE_PING,  # Test connection before checkout
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_recycle=POOL_RECYCLE,  # Recycle connections after 1 hour
    pool_timeout=30,
    echo_pool=os.getenv("DEBUG_SQL", "false").lower() == "true",
    # Connection arguments for better reliability
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    } if "postgresql" in DATABASE_URL else {},
)


# Event listeners for connection monitoring
@event.listens_for(Pool, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Log successful connections"""
    logger.debug("Database connection established")


@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Validate connection on checkout"""
    logger.debug("Connection checked out from pool")


@event.listens_for(Pool, "checkin")
def receive_checkin(dbapi_conn, connection_record):
    """Log connection return to pool"""
    logger.debug("Connection returned to pool")

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

def get_db():
    """
    Database session dependency with error handling.
    Automatically retries on connection failures.
    """
    db = SessionLocal()
    try:
        yield db
    except exc.DBAPIError as e:
        logger.error(f"Database error: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


def check_db_health() -> bool:
    """
    Check database connectivity.
    Returns True if database is accessible, False otherwise.
    """
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

