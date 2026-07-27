from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog


async def log(
    db: AsyncSession,
    *,
    workspace_id: int | None,
    api_key_id: int | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(AuditLog(
        workspace_id=workspace_id,
        api_key_id=api_key_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip=ip,
        user_agent=user_agent,
        metadata=metadata,
    ))
    await db.commit()
