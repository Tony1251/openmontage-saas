from __future__ import annotations
from pydantic import BaseModel
from typing import Literal


class CheckoutRequest(BaseModel):
    plan: Literal["pro", "enterprise"]


class CheckoutResponse(BaseModel):
    url: str


class PortalResponse(BaseModel):
    url: str
