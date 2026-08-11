from __future__ import annotations
import os
import json
from typing import Annotated
from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.db import get_db
from app.models import Render, RenderStatus, Subscription, Plan, Workspace, User, WorkspaceMember
from app.config import settings
from app.services.stripe_service import verify_webhook

router = APIRouter(tags=["webhooks"])

MOCK_MODE = os.environ.get("MOCK_MODE") == "true"


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header()] = None,
) -> dict:
    if not stripe_signature and not MOCK_MODE:
        raise HTTPException(status_code=400, detail={"error": "missing_signature"})
    payload = await request.body()
    try:
        event = verify_webhook(payload, stripe_signature or "")
    except Exception:
        if MOCK_MODE:
            event = json.loads(payload)
        else:
            raise HTTPException(status_code=400, detail={"error": "invalid_signature"})

    db = await anext(get_db())

    try:
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})

        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            workspace_id_str = data.get("metadata", {}).get("workspace_id") or data.get("client_reference_id", "")
            stripe_id = data["id"]
            stripe_price = data["items"]["data"][0]["price"]["id"]
            plan_type = Plan.pro if stripe_price == settings.stripe_price_pro else Plan.enterprise
            status_str = data["status"]
            period_end = datetime.fromtimestamp(data["current_period_end"], tz=timezone.utc)
            cancel_at_period_end = data.get("cancel_at_period_end", False)

            ws_query = await db.execute(select(Workspace).where(Workspace.id == int(workspace_id_str if workspace_id_str else 0)))
            ws = ws_query.scalar_one_or_none()
            if not ws:
                return {"received": True, "note": "workspace not found"}

            customer_id = data.get("customer")
            if customer_id and not ws.stripe_customer_id:
                await db.execute(
                    update(Workspace).where(Workspace.id == ws.id).values(stripe_customer_id=customer_id)
                )

            sub_query = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_id))
            sub = sub_query.scalar_one_or_none()
            if sub:
                sub.status = status_str
                sub.stripe_price_id = stripe_price
                sub.plan = plan_type
                sub.current_period_end = period_end
                sub.cancel_at_period_end = cancel_at_period_end
                sub.updated_at = datetime.now(timezone.utc)
            else:
                db.add(Subscription(
                    workspace_id=ws.id,
                    stripe_subscription_id=stripe_id,
                    stripe_price_id=stripe_price,
                    plan=plan_type,
                    status=status_str,
                    current_period_end=period_end,
                    cancel_at_period_end=cancel_at_period_end,
                ))

            ws.plan = plan_type
            if plan_type == Plan.pro:
                ws.monthly_render_quota = 200
            elif plan_type == Plan.enterprise:
                ws.monthly_render_quota = 10000

        elif event_type == "customer.subscription.deleted":
            stripe_id = data["id"]
            sub_query = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_id))
            sub = sub_query.scalar_one_or_none()
            if sub:
                sub.status = "canceled"
                sub.updated_at = datetime.now(timezone.utc)
                sub.cancel_at_period_end = True
                ws_query = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
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


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    svix_signature: Annotated[str | None, Header(alias="svix-signature")] = None,
    svix_id: Annotated[str | None, Header(alias="svix-id")] = None,
    svix_timestamp: Annotated[str | None, Header(alias="svix-timestamp")] = None,
) -> dict:
    """Handle Clerk webhook events: user.created, user.updated, user.deleted."""
    payload = await request.body()

    if not MOCK_MODE:
        if not svix_signature or not svix_id or not svix_timestamp:
            raise HTTPException(status_code=400, detail={"error": "missing_svix_headers"})
        try:
            from svix.webhooks import Webhook
            wh = Webhook(settings.clerk_webhook_secret)
            wh.verify(payload, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            })
        except Exception:
            raise HTTPException(status_code=400, detail={"error": "invalid_signature"})

    try:
        body = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail={"error": "invalid_json"})

    event_type = body.get("type", "")
    data = body.get("data", {})

    db = await anext(get_db())
    try:
        if event_type == "user.created":
            clerk_id = data.get("id", "")
            email = data.get("email_addresses", [{}])[0].get("email_address", "") if data.get("email_addresses") else ""
            name = data.get("first_name", "") or ""
            if data.get("last_name"):
                name = f"{name} {data['last_name']}".strip()
            avatar_url = data.get("image_url") or data.get("profile_image_url")

            existing = await db.execute(select(User).where(User.clerk_user_id == clerk_id))
            user = existing.scalar_one_or_none()

            if user:
                user.email = email
                if name:
                    user.name = name
                if avatar_url:
                    user.avatar_url = avatar_url
                await db.commit()
            else:
                user = User(
                    clerk_user_id=clerk_id,
                    email=email,
                    name=name or None,
                    avatar_url=avatar_url,
                )
                db.add(user)
                await db.flush()

                slug = f"ws-{user.id}-{abs(hash(clerk_id)) % 10000:04d}"
                workspace = Workspace(
                    owner_id=user.id,
                    name=f"{name or email.split('@')[0]}'s Workspace",
                    slug=slug,
                    plan="free",
                    monthly_render_quota=10,
                )
                db.add(workspace)
                await db.flush()

                member = WorkspaceMember(
                    workspace_id=workspace.id,
                    user_id=user.id,
                    role="owner",
                )
                db.add(member)
                await db.commit()

        elif event_type == "user.updated":
            clerk_id = data.get("id", "")
            email = data.get("email_addresses", [{}])[0].get("email_address", "") if data.get("email_addresses") else ""
            name = data.get("first_name", "") or ""
            if data.get("last_name"):
                name = f"{name} {data['last_name']}".strip()
            avatar_url = data.get("image_url") or data.get("profile_image_url")

            existing = await db.execute(select(User).where(User.clerk_user_id == clerk_id))
            user = existing.scalar_one_or_none()
            if user:
                if email:
                    user.email = email
                if name:
                    user.name = name
                if avatar_url:
                    user.avatar_url = avatar_url
                await db.commit()

        elif event_type == "user.deleted":
            clerk_id = data.get("id", "")
            existing = await db.execute(select(User).where(User.clerk_user_id == clerk_id))
            user = existing.scalar_one_or_none()
            if user:
                await db.delete(user)
                await db.commit()

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
            render.status = RenderStatus.succeeded if status_str == "succeeded" else RenderStatus.failed

        render.completed_at = datetime.now(timezone.utc)
        await db.commit()
    finally:
        await db.close()

    return {"received": True}
