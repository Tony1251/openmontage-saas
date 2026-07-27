from __future__ import annotations
from pydantic import BaseModel
from typing import Literal, Optional


class PlanResponse(BaseModel):
    plan: str = "free"
    status: str = "active"
    current_period_end: Optional[str] = None
    monthly_render_quota: int = 10
    renders_used: int = 0


class CheckoutRequest(BaseModel):
    plan: Literal["pro", "enterprise"]


class CheckoutResponse(BaseModel):
    url: str
    session_id: str = ""


class PortalResponse(BaseModel):
    url: str


class InvoiceResponse(BaseModel):
    id: str
    amount_cents: int
    currency: str = "usd"
    status: str = "paid"
    invoice_pdf_url: Optional[str] = None
    period_start: str = ""
    period_end: str = ""
