"""Vision analysis endpoint tests (stubbed ArkVisionClient)."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_analyze_vision_returns_result(client):
    resp = await client.post(
        "/v1/vision/analyze",
        json={"image_url": "https://example.com/img.jpg", "prompt": "描述这张图"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "result" in data
    assert "描述这张图" in data["result"]


@pytest.mark.asyncio
async def test_analyze_vision_missing_prompt_422(client):
    resp = await client.post(
        "/v1/vision/analyze", json={"image_url": "https://example.com/img.jpg"}
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_vision_custom_model_forwarded(client):
    resp = await client.post(
        "/v1/vision/analyze",
        json={
            "image_url": "https://example.com/img.jpg",
            "prompt": "hello",
            "model": "doubao-embedding-vision-251215",
        },
    )
    assert resp.status_code == 200, resp.text


class _BoomArkVision:
    """Fault-injected vision client: analyze always raises (e.g. bad key)."""

    async def analyze(self, image_url, prompt, model=None):
        raise RuntimeError("ARK_API_KEY not configured")


@pytest.mark.asyncio
async def test_analyze_vision_503_escape_hatch(client):
    """Contract: when the vision provider fails, the route must return
    503 with ``vision_unavailable`` — not a 500 and not a silent success."""
    from app.main import app
    from app.services.ark_vision import get_ark_vision

    app.dependency_overrides[get_ark_vision] = lambda: _BoomArkVision()
    try:
        resp = await client.post(
            "/v1/vision/analyze",
            json={"image_url": "https://example.com/img.jpg", "prompt": "描述这张图"},
        )
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"]["error"] == "vision_unavailable"
    finally:
        app.dependency_overrides.pop(get_ark_vision, None)
