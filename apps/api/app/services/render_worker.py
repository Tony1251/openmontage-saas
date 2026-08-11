"""Background worker: drives render lifecycle queued/running -> succeeded/failed.

Polls MCP for the video task status and updates the DB. Started from app lifespan
when MOCK_MODE=true so local dev gets a fully closed loop.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db import AsyncSession, get_db, engine
from app.models import Render, RenderStatus
from app.services.openmontage import MCPClient

log = logging.getLogger("render-worker")


async def _poll_one(client: MCPClient, render: Render, session: AsyncSession) -> None:
    if render.status == RenderStatus.running and render.ark_task_id:
        result = await client.get_video_status(render.ark_task_id)
        data = result.get("data", {})
        status = data.get("status", "")
        if status == "succeeded":
            render.status = RenderStatus.succeeded
            render.video_url = data.get("video_url") or render.video_url
            render.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            log.info("render %s completed: %s", render.id, render.video_url)
        elif status in ("failed", "cancelled", "expired"):
            render.status = RenderStatus.failed
            render.error = result.get("error") or data.get("error") or "video generation failed"
            render.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            log.warning("render %s failed: %s", render.id, render.error)
        await session.commit()
    elif render.status == RenderStatus.queued:
        try:
            sub = await client.submit_video_render(
                prompt=render.prompt,
                model=render.model,
                duration_sec=render.duration_sec,
                resolution=render.resolution,
                metadata=render.extra_metadata,
            )
            if sub.get("task_id"):
                render.ark_task_id = sub["task_id"]
                render.status = RenderStatus.running
            elif sub.get("video_url"):
                render.status = RenderStatus.succeeded
                render.video_url = sub["video_url"]
                render.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                render.status = RenderStatus.failed
                render.error = sub.get("error") or "no task id returned"
                render.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await session.commit()
        except Exception as e:  # noqa: BLE001
            log.warning("render %s submit failed: %s", render.id, e)


async def run_worker(stop_event: asyncio.Event) -> None:
    """Scan for queued/running renders every 3s and advance them via MCP."""
    client = MCPClient()
    try:
        while not stop_event.is_set():
            try:
                async with engine.begin():
                    pass  # quick liveness check
                async for session in get_db():
                    result = await session.execute(
                        select(Render)
                        .where(Render.status.in_([RenderStatus.queued, RenderStatus.running]))
                        .order_by(Render.created_at)
                        .limit(10)
                    )
                    renders = result.scalars().all()
                    for render in renders:
                        await _poll_one(client, render, session)
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                log.warning("worker loop error: %s", e)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                continue
    finally:
        await client.close()
