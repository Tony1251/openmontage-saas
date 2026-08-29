"""Render endpoint tests against real SQLite + stubbed MCP."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "version" in data


@pytest.mark.asyncio
async def test_create_render_returns_201(client):
    response = await client.post(
        "/v1/renders",
        json={"prompt": "A beautiful sunset", "duration_sec": 5, "resolution": "720p"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["status"] in ("queued", "running")
    assert isinstance(data["id"], int)
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_render_persists_to_db(client, db_session):
    from sqlalchemy import select

    from app.models import Render

    resp = await client.post(
        "/v1/renders",
        json={"prompt": "cinematic drone shot", "duration_sec": 5, "resolution": "720p"},
    )
    assert resp.status_code == 201, resp.text
    render_id = resp.json()["id"]

    result = await db_session.execute(select(Render).where(Render.id == render_id))
    render = result.scalar_one()
    assert render.prompt == "cinematic drone shot"
    assert render.ark_task_id == "ark_test_123"


@pytest.mark.asyncio
async def test_get_render_by_id(client):
    create = await client.post(
        "/v1/renders", json={"prompt": "hello", "duration_sec": 5, "resolution": "720p"}
    )
    assert create.status_code == 201, create.text
    rid = create.json()["id"]

    got = await client.get(f"/v1/renders/{rid}")
    assert got.status_code == 200, got.text
    assert got.json()["prompt"] == "hello"


@pytest.mark.asyncio
async def test_get_render_404(client):
    got = await client.get("/v1/renders/99999")
    assert got.status_code == 404
