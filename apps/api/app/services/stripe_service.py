from __future__ import annotations
import os
import stripe
from datetime import datetime, timezone, timedelta
from typing import Any

from app.config import settings

stripe.api_key = settings.stripe_secret_key

MOCK_MODE = os.environ.get("MOCK_MODE") == "true"


def create_checkout_session(workspace_id: int, plan: str, success_url: str, cancel_url: str) -> str:
    if MOCK_MODE:
        return f"{settings.web_base_url}/dashboard/billing/success?plan={plan}&session_id=cs_mock_{workspace_id}"
    price_id = settings.stripe_price_pro if plan == "pro" else settings.stripe_price_enterprise
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=str(workspace_id),
        metadata={"workspace_id": str(workspace_id), "plan": plan},
    )
    return session.url


def create_portal_session(customer_id: str, return_url: str) -> str:
    if MOCK_MODE:
        return f"{settings.web_base_url}/dashboard/billing"
    session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return session.url


def verify_webhook(payload: bytes, signature: str) -> dict[str, Any]:
    if MOCK_MODE:
        import json
        return json.loads(payload)
    event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    return event


def list_invoices(customer_id: str, limit: int = 12) -> list[dict[str, Any]]:
    if MOCK_MODE:
        invoices = []
        for i in range(min(limit, 6)):
            period_start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30 * i)
            period_end = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30 * (i - 1)) if i > 0 else datetime.now(timezone.utc)
            invoices.append({
                "id": f"in_mock_{i+1:04d}",
                "amount_cents": 2000 if i == 0 else 0,
                "currency": "usd",
                "status": "paid",
                "invoice_pdf_url": None,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
            })
        return invoices
    invoices = stripe.Invoice.list(customer=customer_id, limit=limit)
    result = []
    for inv in invoices.auto_paging_iter():
        result.append({
            "id": inv.id,
            "amount_cents": inv.amount_due,
            "currency": inv.currency,
            "status": inv.status,
            "invoice_pdf_url": inv.invoice_pdf,
            "period_start": datetime.fromtimestamp(inv.period_start, tz=timezone.utc).isoformat() if inv.period_start else "",
            "period_end": datetime.fromtimestamp(inv.period_end, tz=timezone.utc).isoformat() if inv.period_end else "",
        })
    return result
