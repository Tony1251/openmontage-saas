from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select, update

from app.config import settings
from app.db import get_db
from app.models import Plan, Render, RenderStatus, Subscription, Workspace
from app.services.stripe_service import verify_webhook

router = APIRouter(tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header()] = None,
) -> dict:
    if not stripe_signature:
        raise HTTPException(status_code=400, detail={"error": "missing_signature"})
    payload = await request.body()
    try:
        event = verify_webhook(payload, stripe_signature)
    except Exception as e:
        raise HTTPException(status_code=400, detail={"error": "invalid_signature"}) from e

    db = await anext(get_db())

    try:
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})

        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            workspace_id_str = data.get("metadata", {}).get("workspace_id") or data.get(
                "client_reference_id", ""
            )
            stripe_id = data["id"]
            stripe_price = data["items"]["data"][0]["price"]["id"]
            plan_type = Plan.pro if stripe_price == settings.stripe_price_pro else Plan.enterprise
            status_str = data["status"]
            period_end = datetime.fromtimestamp(data["current_period_end"], tz=UTC)
            cancel_at_period_end = data.get("cancel_at_period_end", False)

            ws_query = await db.execute(
                select(Workspace).where(
                    Workspace.id == int(workspace_id_str if workspace_id_str else 0)
                )
            )
            ws = ws_query.scalar_one_or_none()
            if not ws:
                return {"received": True, "note": "workspace not found"}

            customer_id = data.get("customer")
            if customer_id and not ws.stripe_customer_id:
                await db.execute(
                    update(Workspace)
                    .where(Workspace.id == ws.id)
                    .values(stripe_customer_id=customer_id)
                )

            sub_query = await db.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_id)
            )
            sub = sub_query.scalar_one_or_none()
            if sub:
                sub.status = status_str
                sub.stripe_price_id = stripe_price
                sub.plan = plan_type
                sub.current_period_end = period_end
                sub.cancel_at_period_end = cancel_at_period_end
                sub.updated_at = datetime.now(UTC)
            else:
                db.add(
                    Subscription(
                        workspace_id=ws.id,
                        stripe_subscription_id=stripe_id,
                        stripe_price_id=stripe_price,
                        plan=plan_type,
                        status=status_str,
                        current_period_end=period_end,
                        cancel_at_period_end=cancel_at_period_end,
                    )
                )

            ws.plan = plan_type
            if plan_type == Plan.pro:
                ws.monthly_render_quota = 200
            elif plan_type == Plan.enterprise:
                ws.monthly_render_quota = 10000

        elif event_type == "customer.subscription.deleted":
            stripe_id = data["id"]
            sub_query = await db.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_id)
            )
            sub = sub_query.scalar_one_or_none()
            if sub:
                sub.status = "canceled"
                sub.updated_at = datetime.now(UTC)
                sub.cancel_at_period_end = True
                ws_query = await db.execute(
                    select(Workspace).where(Workspace.id == sub.workspace_id)
                )
                ws = ws_query.scalar_one_or_none()
                if ws:
                    ws.plan = Plan.free
                    ws.monthly_render_quota = 10

        elif event_type in ("invoice.paid", "invoice.failed"):
            pass

        await db.commit()
    finally:
        await db.close()

    return {"received": True}


@router.post("/render-complete")
async def render_complete_webhook(
    request: Request,
) -> dict:
    body = await request.json()
    ark_task_id = body.get("ark_task_id")
    status_str = body.get("status", "")
    video_url = body.get("video_url")

    if not ark_task_id:
        raise HTTPException(status_code=400, detail={"error": "missing_ark_task_id"})

    db = await anext(get_db())
    try:
        result = await db.execute(select(Render).where(Render.ark_task_id == ark_task_id))
        render = result.scalar_one_or_none()
        if not render:
            return {"received": True, "note": "render not found"}

        if status_str == "succeeded":
            render.status = RenderStatus.succeeded
            render.video_url = video_url
        elif status_str == "failed":
            render.status = RenderStatus.failed
            render.error = body.get("error")
        else:
            render.status = (
                RenderStatus.succeeded if status_str == "succeeded" else RenderStatus.failed
            )

        render.completed_at = datetime.now(UTC)
        await db.commit()
    finally:
        await db.close()

    return {"received": True}
