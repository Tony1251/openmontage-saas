from __future__ import annotations
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import QuotaUsage, Workspace


def current_period_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def check_and_increment_renders(db: AsyncSession, workspace: Workspace) -> int:
    """Atomically check + increment monthly render quota. Raises 429 if exceeded."""
    period = current_period_start()
    # Ensure row exists
    await db.execute(
        update(QuotaUsage)
        .where(QuotaUsage.workspace_id == workspace.id, QuotaUsage.period_start == period)
        .values(renders_used=QuotaUsage.renders_used + 0)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(
        update(QuotaUsage)
        .where(
            QuotaUsage.workspace_id == workspace.id,
            QuotaUsage.period_start == period,
            QuotaUsage.renders_used < workspace.monthly_render_quota,
        )
        .values(renders_used=QuotaUsage.renders_used + 1, updated_at=datetime.now(timezone.utc))
        .returning(QuotaUsage.renders_used)
        .execution_options(synchronize_session=False)
    )
    new_count = result.scalar_one_or_none()
    if new_count is None:
        existing = await db.execute(
            select(QuotaUsage).where(QuotaUsage.workspace_id == workspace.id, QuotaUsage.period_start == period)
        )
        if not existing.scalar_one_or_none():
            db.add(QuotaUsage(workspace_id=workspace.id, period_start=period, renders_used=1))
            await db.commit()
            return 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "monthly_quota_exceeded",
                "used": workspace.monthly_render_quota,
                "limit": workspace.monthly_render_quota,
                "upgrade_url": f"{settings.web_base_url}/dashboard/billing",
            },
        )
    await db.commit()
    return new_count
