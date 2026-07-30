"""MongoDB connection helpers kept separate from feature repositories."""

from functools import lru_cache

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.config import get_settings


@lru_cache
def get_database() -> Database:
    settings = get_settings()
    if not settings.mongodb_uri:
        raise RuntimeError("MONGODB_URI must be configured to use inventory endpoints")
    client = MongoClient(
        settings.mongodb_uri,
        tz_aware=True,
        uuidRepresentation="standard",
        serverSelectionTimeoutMS=5_000,
        connectTimeoutMS=5_000,
        retryReads=True,
        retryWrites=True,
        maxPoolSize=50,
    )
    return client[settings.mongodb_database]


def check_database() -> bool:
    """Return whether MongoDB is reachable without exposing connection details."""
    try:
        get_database().command("ping")
        return True
    except Exception:
        return False


def ensure_indexes() -> None:
    """Create cross-feature indexes once during startup; safe to call repeatedly."""
    db = get_database()
    db["users"].create_index([("email", ASCENDING)], unique=True)
    db["customers"].create_index([("businessId", ASCENDING), ("name", ASCENDING)])
    db["customers"].create_index([("businessId", ASCENDING), ("phone", ASCENDING)], unique=True, partialFilterExpression={"phone": {"$type": "string"}})
    db["transactions"].create_index([("businessId", ASCENDING), ("createdAt", DESCENDING)])
    db["transactions"].create_index([("businessId", ASCENDING), ("customerId", ASCENDING), ("createdAt", DESCENDING)])
    db["inventory_logs"].create_index([("businessId", ASCENDING), ("productId", ASCENDING), ("createdAt", DESCENDING)])
    db["refresh_tokens"].create_index([("jti", ASCENDING)], unique=True)
    db["refresh_tokens"].create_index([("userId", ASCENDING), ("revokedAt", ASCENDING)])
    db["notifications"].create_index([("businessId", ASCENDING), ("createdAt", DESCENDING)])
    db["suppliers"].create_index([("businessId", ASCENDING), ("name", ASCENDING)])
    db["customer_payments"].create_index([("businessId", ASCENDING), ("customerId", ASCENDING), ("createdAt", DESCENDING)])
    db["email_outbox"].create_index([("token", ASCENDING)])
