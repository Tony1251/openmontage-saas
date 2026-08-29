from __future__ import annotations

import stripe

from app.config import settings

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(workspace_id: int, plan: str, success_url: str, cancel_url: str) -> str:
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
    session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return session.url


def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
