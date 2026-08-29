from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    plan: Literal["pro", "enterprise"]


class CheckoutResponse(BaseModel):
    url: str


class PortalResponse(BaseModel):
    url: str
