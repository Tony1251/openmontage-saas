"""Video provider contract tests (no real Ark key / network).

Covers three layers:

1. ``VideoGenRequest`` Pydantic validation — illegal values rejected at the
   model boundary (duration=0, width=-1, empty prompt, seed<0).
2. ``ArkSeedanceProvider`` submit/poll — request payload shape and response
   parsing against a mocked transport (state machine: succeeded / failed /
   unrecognised status).
3. Router integration — 503 ``video_unavailable`` escape hatch when a provider
   fails, and the submit→poll state machine through ``POST/GET /v1/renders``
   using a fake provider.
"""

from __future__ import annotations

import json

import httpx
import pytest
from pydantic import ValidationError

from app.schemas.video import TaskStatus, VideoGenRequest
from app.services.video_provider import (
    ArkSeedanceProvider,
    _resolution_and_ratio,
)

# ── 1. Pydantic validation boundaries ─────────────────────────────

def test_video_gen_request_defaults():
    req = VideoGenRequest(prompt="hello")
    assert req.width == 1280
    assert req.height == 720
    assert req.duration == 5
    assert req.seed is None
    assert req.extra == {}


@pytest.mark.parametrize(
    "kwargs",
    [
        {"prompt": ""},                 # empty prompt
        {"prompt": "x", "duration": 0},
        {"prompt": "x", "duration": 31},
        {"prompt": "x", "width": 63},
        {"prompt": "x", "width": 1921},
        {"prompt": "x", "height": -1},
        {"prompt": "x", "seed": -1},
    ],
)
def test_video_gen_request_rejects_invalid(kwargs):
    with pytest.raises(ValidationError):
        VideoGenRequest(**kwargs)


def test_resolution_and_ratio_mapping():
    assert _resolution_and_ratio(1920, 1080) == ("1080p", "16:9")
    assert _resolution_and_ratio(1280, 720) == ("720p", "16:9")
    assert _resolution_and_ratio(854, 480) == ("480p", "16:9")
    assert _resolution_and_ratio(720, 1280) == ("1080p", "9:16")
    assert _resolution_and_ratio(1080, 1080) == ("1080p", "1:1")


# ── 2. ArkSeedanceProvider submit / poll (mocked transport) ────────

def _mock_transport(handler):
    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_ark_submit_returns_task_id(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "test-key")
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["json"] = json.loads(request.content)
        assert request.headers["Authorization"] == "Bearer test-key"
        return httpx.Response(200, json={"id": "cgt-test-123"})

    provider = ArkSeedanceProvider(transport=_mock_transport(handler))
    task_id = await provider.submit(VideoGenRequest(prompt="a monster fight", duration=5))
    assert task_id == "cgt-test-123"
    assert captured["url"].endswith("/contents/generations/tasks")
    body = captured["json"]
    assert body["model"] == "doubao-seedance-1-0-pro-250528"
    assert body["content"] == [{"type": "text", "text": "a monster fight"}]
    assert body["duration"] == 5
    await provider.close()


@pytest.mark.asyncio
async def test_ark_submit_missing_key_raises_runtime(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "")
    provider = ArkSeedanceProvider(transport=_mock_transport(lambda _: httpx.Response(200, json={})))
    with pytest.raises(RuntimeError, match="ARK_API_KEY not configured"):
        await provider.submit(VideoGenRequest(prompt="x"))
    await provider.close()


@pytest.mark.asyncio
async def test_ark_submit_unexpected_response_raises_runtime(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "test-key")
    provider = ArkSeedanceProvider(
        transport=_mock_transport(lambda _: httpx.Response(200, json={"unexpected": True}))
    )
    with pytest.raises(RuntimeError, match="unexpected submit response"):
        await provider.submit(VideoGenRequest(prompt="x"))
    await provider.close()


@pytest.mark.asyncio
async def test_ark_poll_succeeded_extracts_video_url(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "cgt-test-123",
                "status": "succeeded",
                "content": {"video_url": "https://oss.example.com/v.mp4"},
            },
        )

    provider = ArkSeedanceProvider(transport=_mock_transport(handler))
    result = await provider.poll("cgt-test-123")
    assert result.status is TaskStatus.succeeded
    assert result.video_url == "https://oss.example.com/v.mp4"
    assert result.error is None
    await provider.close()


@pytest.mark.asyncio
async def test_ark_poll_failed_extracts_error(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"id": "cgt-test-123", "status": "failed", "error": {"message": "rejected prompt"}},
        )

    provider = ArkSeedanceProvider(transport=_mock_transport(handler))
    result = await provider.poll("cgt-test-123")
    assert result.status is TaskStatus.failed
    assert result.error == "rejected prompt"
    await provider.close()


@pytest.mark.asyncio
async def test_ark_poll_unrecognised_status_defaults_pending(monkeypatch):
    monkeypatch.setattr("app.services.video_provider.settings.ark_api_key", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "cgt-test-123", "status": "weird"})

    provider = ArkSeedanceProvider(transport=_mock_transport(handler))
    result = await provider.poll("cgt-test-123")
    assert result.status is TaskStatus.pending
    await provider.close()


# ── 3. Router integration (fake provider) ─────────────────────────

class _FakeProvider:
    """Stateful fake: submit → running → (optional) succeeded."""

    def __init__(self, task_id: str = "fake_task_1", fail: bool = False):
        self.task_id = task_id
        self.fail = fail
        self.poll_count = 0
        self.submitted: VideoGenRequest | None = None

    async def submit(self, req: VideoGenRequest) -> str:
        self.submitted = req
        return self.task_id

    async def poll(self, task_id: str):
        self.poll_count += 1
        if self.fail:
            return _result(task_id, TaskStatus.failed, error="boom")
        # First poll → running, subsequent → succeeded.
        if self.poll_count == 1:
            return _result(task_id, TaskStatus.running)
        return _result(task_id, TaskStatus.succeeded, video_url="https://oss.example.com/final.mp4")


def _result(task_id, status, video_url=None, error=None):
    from app.schemas.video import VideoGenResult

    return VideoGenResult(task_id=task_id, status=status, video_url=video_url, error=error)


@pytest.mark.asyncio
async def test_router_submit_then_poll_to_succeeded(client, db_session):
    from app.main import app
    from app.services.video_provider import get_video_provider

    fake = _FakeProvider()
    app.dependency_overrides[get_video_provider] = lambda: fake
    try:
        create = await client.post("/v1/renders", json={"prompt": "ultraman vs monster", "duration_sec": 5, "resolution": "720p"})
        assert create.status_code == 201, create.text
        rid = create.json()["id"]
        assert fake.submitted.prompt == "ultraman vs monster"
        assert fake.submitted.width == 1280
        assert fake.submitted.height == 720

        # First GET → running (poll #1), video_url still None.
        got1 = await client.get(f"/v1/renders/{rid}")
        assert got1.status_code == 200
        assert got1.json()["status"] == "running"
        assert got1.json()["video_url"] is None

        # Second GET → succeeded, video_url resolved.
        got2 = await client.get(f"/v1/renders/{rid}")
        assert got2.status_code == 200
        assert got2.json()["status"] == "succeeded"
        assert got2.json()["video_url"] == "https://oss.example.com/final.mp4"
    finally:
        app.dependency_overrides.pop(get_video_provider, None)


@pytest.mark.asyncio
async def test_router_poll_to_failed(client, db_session):
    from app.main import app
    from app.services.video_provider import get_video_provider

    app.dependency_overrides[get_video_provider] = lambda: _FakeProvider(fail=True)
    try:
        create = await client.post("/v1/renders", json={"prompt": "doomed", "duration_sec": 5, "resolution": "720p"})
        rid = create.json()["id"]
        got = await client.get(f"/v1/renders/{rid}")
        assert got.json()["status"] == "failed"
        assert got.json()["error"] == "boom"
    finally:
        app.dependency_overrides.pop(get_video_provider, None)


class _BoomProvider:
    async def submit(self, req: VideoGenRequest) -> str:
        raise RuntimeError("ARK_API_KEY not configured")

    async def poll(self, task_id: str):
        raise RuntimeError("n/a")


@pytest.mark.asyncio
async def test_router_503_video_unavailable(client, db_session):
    from app.main import app
    from app.services.video_provider import get_video_provider

    app.dependency_overrides[get_video_provider] = lambda: _BoomProvider()
    try:
        resp = await client.post("/v1/renders", json={"prompt": "x", "duration_sec": 5, "resolution": "720p"})
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"]["error"] == "video_unavailable"
    finally:
        app.dependency_overrides.pop(get_video_provider, None)
