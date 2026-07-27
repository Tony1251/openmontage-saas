from __future__ import annotations
import os
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.auth import get_auth, AuthContext
from app.config import settings
from app.db import get_db
from app.models import Subscription, QuotaUsage, Workspace
from app.schemas.billing import (
    PlanResponse,
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
    InvoiceResponse,
)
from app.services.stripe_service import (
    create_checkout_session,
    create_portal_session,
    list_invoices,
)

router = APIRouter(tags=["billing"])

MOCK_MODE = os.environ.get("MOCK_MODE") == "true"


@router.get("/billing/plan")
async def get_plan(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PlanResponse:
    """Get current plan and usage for the authenticated workspace."""
    ws = auth.workspace
    plan = ws.plan.value if hasattr(ws.plan, "value") else ws.plan
    quota = ws.monthly_render_quota

    # Get subscription info
    subscription = None
    status_str = "active"
    current_period_end = None
    if not MOCK_MODE:
        sub_result = await db.execute(
            select(Subscription).where(Subscription.workspace_id == ws.id)
        )
        subscription = sub_result.scalar_one_or_none()
        if subscription:
            status_str = subscription.status
            current_period_end = subscription.current_period_end.isoformat() if subscription.current_period_end else None

    # Get current period usage
    now = datetime.now(timezone.utc)
    period_start = datetime(now.year, now.month, 1)
    usage_result = await db.execute(
        select(QuotaUsage.renders_used)
        .where(QuotaUsage.workspace_id == ws.id, QuotaUsage.period_start == period_start)
    )
    renders_used = usage_result.scalar_one_or_none() or 0

    return PlanResponse(
        plan=plan,
        status=status_str,
        current_period_end=current_period_end,
        monthly_render_quota=quota,
        renders_used=renders_used,
    )


@router.post("/billing/checkout")
async def billing_checkout(
    body: CheckoutRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutResponse:
    success_url = f"{settings.web_base_url}/dashboard/billing?success=1"
    cancel_url = f"{settings.web_base_url}/dashboard/billing?canceled=1"

    url = create_checkout_session(
        workspace_id=auth.workspace.id,
        plan=body.plan,
        success_url=success_url,
        cancel_url=cancel_url,
    )

    session_id = ""
    if "session_id=" in url:
        session_id = url.split("session_id=")[-1].split("&")[0]

    return CheckoutResponse(url=url, session_id=session_id)


@router.post("/billing/portal")
async def billing_portal(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PortalResponse:
    customer_id = auth.workspace.stripe_customer_id
    if not customer_id and not MOCK_MODE:
        raise HTTPException(status_code=400, detail={"error": "no_subscription", "message": "no active subscription found"})
    return_url = f"{settings.web_base_url}/dashboard/billing"
    url = create_portal_session(
        customer_id=customer_id or "cus_mock",
        return_url=return_url,
    )
    return PortalResponse(url=url)


@router.get("/billing/invoices")
async def billing_invoices(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 12,
) -> list[InvoiceResponse]:
    """Get invoice history."""
    customer_id = auth.workspace.stripe_customer_id
    if not customer_id and not MOCK_MODE:
        return []

    invoices_data = list_invoices(
        customer_id=customer_id or "cus_mock",
        limit=limit,
    )

    return [
        InvoiceResponse(
            id=inv["id"],
            amount_cents=inv["amount_cents"],
            currency=inv.get("currency", "usd"),
            status=inv.get("status", "paid"),
            invoice_pdf_url=inv.get("invoice_pdf_url"),
            period_start=inv.get("period_start", ""),
            period_end=inv.get("period_end", ""),
        )
        for inv in invoices_data
    ]
