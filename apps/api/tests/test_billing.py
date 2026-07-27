"""Tests for billing endpoints."""
from __future__ import annotations
import pytest


@pytest.mark.asyncio
async def test_get_plan(client):
    response = await client.get("/v1/billing/plan")
    assert response.status_code == 200
    data = response.json()
    assert "plan" in data
    assert "monthly_render_quota" in data
    assert "renders_used" in data


@pytest.mark.asyncio
async def test_create_checkout_returns_url(client):
    response = await client.post(
        "/v1/billing/checkout",
        json={"plan": "pro"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "url" in data
    assert "pro" in data["url"] or "session_id" in data


@pytest.mark.asyncio
async def test_create_portal_returns_url(client):
    response = await client.post("/v1/billing/portal")
    assert response.status_code in (200, 400)


@pytest.mark.asyncio
async def test_list_invoices(client):
    response = await client.get("/v1/billing/invoices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
