from __future__ import annotations
import hashlib
import secrets
from dataclasses import dataclass
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import ApiKey, Workspace, User

LIVE_PREFIX = "sk_live_"
TEST_PREFIX = "sk_test_"
IDEMPOTENCY_CACHE: dict[str, tuple[int, float]] = {}


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def generate_api_key(environment: str = "live") -> tuple[str, str]:
    """Returns (public_key, full_secret). Store only hash of secret."""
    prefix = LIVE_PREFIX if environment == "live" else TEST_PREFIX
    secret = secrets.token_hex(16)
    public = f"{prefix}{secret[:8]}"
    full = f"{prefix}{secret}"
    return public, full


@dataclass
class AuthContext:
    workspace: Workspace
    api_key: ApiKey
    user: User | None


async def get_auth(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "unauthorized", "message": "missing Bearer token"})
    raw = authorization.removeprefix("Bearer ").strip()
    if not (raw.startswith(LIVE_PREFIX) or raw.startswith(TEST_PREFIX)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "unauthorized", "message": "invalid key format"})
    secret = raw[len(LIVE_PREFIX):] if raw.startswith(LIVE_PREFIX) else raw[len(TEST_PREFIX):]
    key_hash = hash_secret(secret)
    result = await db.execute(
        select(ApiKey, Workspace)
        .join(Workspace, ApiKey.workspace_id == Workspace.id)
        .where(ApiKey.key_hash == key_hash, ApiKey.status == "active")
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "unauthorized", "message": "invalid api key"})
    api_key, workspace = row
    return AuthContext(workspace=workspace, api_key=api_key, user=None)


def check_idempotency(key: str | None) -> int | None:
    """Returns existing render_id if key was used in last 24h, else None."""
    if not key:
        return None
    import time
    now = time.time()
    expired = [k for k, (_, exp) in IDEMPOTENCY_CACHE.items() if exp < now]
    for k in expired:
        IDEMPOTENCY_CACHE.pop(k, None)
    cached = IDEMPOTENCY_CACHE.get(key)
    if cached and cached[1] > now:
        return cached[0]
    return None


def record_idempotency(key: str | None, render_id: int) -> None:
    if not key:
        return
    import time
    IDEMPOTENCY_CACHE[key] = (render_id, time.time() + 86400)
