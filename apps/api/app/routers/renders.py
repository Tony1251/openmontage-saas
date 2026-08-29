from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthContext, check_idempotency, get_auth, record_idempotency
from app.db import get_db
from app.models import Render, RenderStatus
from app.schemas.renders import CreateRenderRequest, RenderResponse
from app.schemas.video import TaskStatus, VideoGenRequest
from app.services.audit import log as audit_log
from app.services.credits import (
    InsufficientCreditsError,
    debit_units,
    get_balance,
    refund_units,
    units_for,
)
from app.services.video_provider import VideoProvider, get_video_provider

router = APIRouter(tags=["renders"])

# public resolution token → (width, height) pixels for the provider contract.
_RESOLUTION_DIMS: dict[str, tuple[int, int]] = {
    "480p": (854, 480),
    "720p": (1280, 720),
    "1080p": (1920, 1080),
}


def _to_video_gen_request(body: CreateRenderRequest) -> VideoGenRequest:
    width, height = _RESOLUTION_DIMS.get(body.resolution, (1280, 720))
    return VideoGenRequest(
        prompt=body.prompt,
        width=width,
        height=height,
        duration=body.duration_sec,
        extra={"model": body.model, **(body.extra_metadata or {})},
    )


def _created_response(render: Render) -> dict:
    now = datetime.now(UTC)
    return {
        "id": render.id,
        "status": render.status.value,
        "created_at": render.created_at.isoformat() if render.created_at else now.isoformat(),
        "estimated_completion_at": None,
    }


def _insufficient_credits_exc(required: int, available: int) -> HTTPException:
    return HTTPException(
        status_code=402,
        detail={
            "code": "insufficient_credits",
            "credits_required": required,
            "credits_available": available,
        },
    )


@router.post("/renders", status_code=201)
async def create_render(
    body: CreateRenderRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[VideoProvider, Depends(get_video_provider)],
    idempotency_key: Annotated[str | None, Header()] = None,
) -> dict:
    # Idempotent replay: return the previously created render unchanged.
    existing_id = check_idempotency(idempotency_key)
    if existing_id is not None:
        result = await db.execute(select(Render).where(Render.id == existing_id))
        existing = result.scalar_one_or_none()
        if existing:
            return _created_response(existing)

    req = _to_video_gen_request(body)
    units = units_for(body.resolution, body.duration_sec)

    # Billing idempotency key: the request Idempotency-Key if provided, else a
    # fresh unique token. A render's usage debit and (possible) refund share it.
    billing_key = idempotency_key or secrets.token_hex(16)

    # 1. Pre-check balance → 402 before ever touching the provider (Ark is never
    #    called when the workspace can't afford the render).
    balance = await get_balance(db, auth.workspace.id)
    if balance < units:
        raise _insufficient_credits_exc(units, balance)

    # 2. Create render + debit atomically (same DB transaction).
    render = Render(
        workspace_id=auth.workspace.id,
        api_key_id=auth.api_key.id,
        prompt=body.prompt,
        model=body.model,
        duration_sec=body.duration_sec,
        resolution=body.resolution,
        status=RenderStatus.queued,
        credits_consumed_units=units,
        extra_metadata=body.extra_metadata,
        # cost_cents settled from units × plan price — blocked on PRICING.md §3.
    )
    db.add(render)
    await db.flush()  # assign render.id for the ledger ref_render_id
    try:
        await debit_units(db, auth.workspace.id, units, billing_key, ref_render_id=render.id)
        await db.commit()
    except InsufficientCreditsError as exc:
        await db.rollback()
        raise _insufficient_credits_exc(exc.required, exc.available) from exc
    await db.refresh(render)

    # 3. Submit to the provider (after commit — never hold the txn open).
    try:
        ark_task_id = await provider.submit(req)
    except (RuntimeError, httpx.HTTPError) as exc:
        # 3b. Submit failed → refund (net=0) + mark failed, then surface 503.
        await refund_units(db, auth.workspace.id, units, billing_key, ref_render_id=render.id)
        render.status = RenderStatus.failed
        render.error = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=503,
            detail={"error": "video_unavailable", "message": str(exc)},
        ) from exc

    render.ark_task_id = ark_task_id or None
    render.status = RenderStatus.running if ark_task_id else RenderStatus.queued
    await db.commit()

    record_idempotency(idempotency_key, render.id)

    await audit_log(
        db,
        workspace_id=auth.workspace.id,
        api_key_id=auth.api_key.id,
        action="render.create",
        resource_type="render",
        resource_id=str(render.id),
    )

    return _created_response(render)


@router.get("/renders/{render_id}")
async def get_render(
    render_id: int,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[VideoProvider, Depends(get_video_provider)],
) -> RenderResponse:
    result = await db.execute(
        select(Render).where(Render.id == render_id, Render.workspace_id == auth.workspace.id)
    )
    render = result.scalar_one_or_none()
    if not render:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "render not found"}
        )

    # Poll active tasks on read: only resolve `video_url` once the provider
    # reports succeeded; transient poll failures leave the row untouched.
    if render.status in (RenderStatus.queued, RenderStatus.running) and render.ark_task_id:
        try:
            gen = await provider.poll(render.ark_task_id)
            if gen.status is TaskStatus.succeeded and gen.video_url:
                # TODO(v1): `gen.video_url` is an Ark *signed* URL (24h expiry).
                # Must download the mp4 and re-store via `storage.upload_render`
                # to the SaaS's own OSS/S3 before persisting — never hand tenants
                # the raw Ark signed URL. Blocked on OSS bucket credentials.
                render.status = RenderStatus.succeeded
                render.video_url = gen.video_url
                render.completed_at = datetime.now(UTC)
            elif gen.status is TaskStatus.failed:
                render.status = RenderStatus.failed
                render.error = gen.error or "video generation failed"
                render.completed_at = datetime.now(UTC)
            elif gen.status is TaskStatus.running and render.status is not RenderStatus.running:
                render.status = RenderStatus.running
            await db.commit()
        except (RuntimeError, httpx.HTTPError):
            pass  # transient — return current persisted state

    return _render_response(render)


def _render_response(render: Render) -> RenderResponse:
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
        credits_consumed_units=render.credits_consumed_units,
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
        "data": [_render_response(r) for r in renders_list],
        "has_more": has_more,
        "next_cursor": renders_list[-1].id if has_more else None,
    }
