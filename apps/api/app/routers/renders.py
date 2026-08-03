from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.auth import get_auth, AuthContext, check_idempotency, record_idempotency
from app.db import get_db
from app.models import Render, RenderStatus
from app.schemas.renders import CreateRenderRequest, RenderResponse
from app.services.openmontage import get_mcp as _get_mcp
from app.services.quota import check_and_increment_renders
from app.services.audit import log as audit_log

router = APIRouter(tags=["renders"])


@router.post("/renders", status_code=201)
async def create_render(
    body: CreateRenderRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header()] = None,
) -> dict:
    existing_id = check_idempotency(idempotency_key)
    if existing_id is not None:
        result = await db.execute(select(Render).where(Render.id == existing_id))
        existing = result.scalar_one_or_none()
        if existing:
            return {
                "id": existing.id,
                "status": existing.status.value,
                "created_at": existing.created_at.isoformat(),
                "estimated_completion_at": None,
            }

    await check_and_increment_renders(db, auth.workspace)

    import os
    if os.environ.get("MOCK_MODE") == "true":
        ark_task_id = ""
        status_val = RenderStatus.queued
    else:
        try:
            mcp = _get_mcp()
            ark_task_id = await mcp.submit_video_render(
                prompt=body.prompt,
                model=body.model,
                duration_sec=body.duration_sec,
                resolution=body.resolution,
                metadata=body.extra_metadata,
            )
            status_val = RenderStatus.running if ark_task_id else RenderStatus.queued
        except Exception:
            status_val = RenderStatus.queued
            ark_task_id = ""

    render = Render(
        workspace_id=auth.workspace.id,
        api_key_id=auth.api_key.id,
        ark_task_id=ark_task_id or None,
        prompt=body.prompt,
        model=body.model,
        duration_sec=body.duration_sec,
        resolution=body.resolution,
        status=status_val,
        extra_metadata=body.extra_metadata,
    )
    db.add(render)
    await db.commit()
    await db.refresh(render)

    record_idempotency(idempotency_key, render.id)

    await audit_log(
        db, workspace_id=auth.workspace.id, api_key_id=auth.api_key.id,
        action="render.create", resource_type="render", resource_id=str(render.id),
    )

    now = datetime.now(timezone.utc)
    return {
        "id": render.id,
        "status": render.status.value,
        "created_at": render.created_at.isoformat() if render.created_at else now.isoformat(),
        "estimated_completion_at": None,
    }


@router.get("/renders/{render_id}")
async def get_render(
    render_id: int,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RenderResponse:
    result = await db.execute(
        select(Render).where(Render.id == render_id, Render.workspace_id == auth.workspace.id)
    )
    render = result.scalar_one_or_none()
    if not render:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "render not found"})
    return RenderResponse(
        id=render.id,
        workspace_id=render.workspace_id,
        ark_task_id=render.ark_task_id,
        prompt=render.prompt,
        model=render.model,
        duration_sec=render.duration_sec,
        resolution=render.resolution,
        status=render.status.value,
        video_url=render.video_url,
        error=render.error,
        cost_cents=render.cost_cents,
        extra_metadata=render.extra_metadata,
        created_at=render.created_at.isoformat() if render.created_at else "",
        completed_at=render.completed_at.isoformat() if render.completed_at else None,
    )


@router.get("/renders")
async def list_renders(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    cursor: int | None = Query(default=None),
) -> dict:
    query = select(Render).where(Render.workspace_id == auth.workspace.id)
    if status_filter:
        query = query.where(Render.status == status_filter)
    if cursor:
        query = query.where(Render.id < cursor)
    query = query.order_by(desc(Render.id)).limit(limit + 1)
    result = await db.execute(query)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    renders_list = rows[:limit]

    return {
        "data": [
            RenderResponse(
                id=r.id,
                workspace_id=r.workspace_id,
                ark_task_id=r.ark_task_id,
                prompt=r.prompt,
                model=r.model,
                duration_sec=r.duration_sec,
                resolution=r.resolution,
                status=r.status.value,
                video_url=r.video_url,
                error=r.error,
                cost_cents=r.cost_cents,
                extra_metadata=r.extra_metadata,
                created_at=r.created_at.isoformat() if r.created_at else "",
                completed_at=r.completed_at.isoformat() if r.completed_at else None,
            )
            for r in renders_list
        ],
        "has_more": has_more,
        "next_cursor": renders_list[-1].id if has_more else None,
    }
