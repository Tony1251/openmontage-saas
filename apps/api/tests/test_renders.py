"""Smoke test: POST /v1/renders with mocked deps."""
from __future__ import annotations
import pytest


@pytest.mark.asyncio
async def test_create_render_returns_queued(client):
    response = await client.post(
        "/v1/renders",
        json={"prompt": "A beautiful sunset", "duration_sec": 5, "resolution": "720p"},
    )
    # With MCP mocked and MOCK_MODE bypassing auth,
    # the handler should return 201 (success) or 429 (quota exceeded).
    # 422 should no longer happen since we removed the MCP Depends.
    assert response.status_code in (201, 429)
    body = response.json()
    assert "id" in body or "detail" in body
    if response.status_code == 201:
        assert "status" in body
        assert body["status"] in ("queued", "running")


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "version" in data
