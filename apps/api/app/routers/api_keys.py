from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.auth import get_auth, AuthContext, generate_api_key, hash_secret
from app.db import get_db
from app.models import ApiKey, ApiKeyStatus
from app.schemas.api_keys import CreateApiKeyRequest, CreateApiKeyResponse, ApiKeyResponse

router = APIRouter(tags=["api-keys"])


@router.post("/api-keys", status_code=201)
async def create_api_key(
    body: CreateApiKeyRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CreateApiKeyResponse:
    public_key, full_secret = generate_api_key()
    secret_part = full_secret[len("sk_live_"):] if full_secret.startswith("sk_live_") else full_secret[len("sk_test_"):]
    key_hash = hash_secret(secret_part)

    api_key = ApiKey(
        workspace_id=auth.workspace.id,
        public_key=public_key,
        key_hash=key_hash,
        label=body.label,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return CreateApiKeyResponse(
        id=api_key.id,
        public_key=api_key.public_key,
        full_key=full_secret,
        label=api_key.label,
        created_at=api_key.created_at.isoformat() if api_key.created_at else "",
    )


@router.get("/api-keys")
async def list_api_keys(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ApiKeyResponse]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.workspace_id == auth.workspace.id).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        ApiKeyResponse(
            id=k.id,
            workspace_id=k.workspace_id,
            public_key=k.public_key,
            label=k.label,
            status=k.status.value if hasattr(k.status, "value") else k.status,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            created_at=k.created_at.isoformat() if k.created_at else "",
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: int,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.workspace_id == auth.workspace.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "api key not found"})
    api_key.status = ApiKeyStatus.revoked
    api_key.revoked_at = datetime.now(timezone.utc)
    await db.commit()
