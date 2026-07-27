from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth, AuthContext
from app.config import settings
from app.db import get_db
from app.schemas.billing import CheckoutRequest, CheckoutResponse, PortalResponse
from app.services.stripe_service import create_checkout_session, create_portal_session

router = APIRouter(tags=["billing"])


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
    return CheckoutResponse(url=url)


@router.post("/billing/portal")
async def billing_portal(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PortalResponse:
    if not auth.workspace.stripe_customer_id:
        raise HTTPException(status_code=400, detail={"error": "no_subscription", "message": "no active subscription found"})
    return_url = f"{settings.web_base_url}/dashboard/billing"
    url = create_portal_session(
        customer_id=auth.workspace.stripe_customer_id,
        return_url=return_url,
    )
    return PortalResponse(url=url)
