"""Video-generation provider abstraction + Ark Seedance implementation.

Design (per architect contract):

* ``VideoProvider`` is a ``Protocol`` — the router depends on the interface,
  never on a concrete client, so the OpenMontage MCP core can be added later as
  a second provider with zero router changes.
* ``ArkSeedanceProvider`` is the first implementation: it talks to the Volcano
  Engine Ark *content generation* API directly (async submit + poll), storing
  the Ark task id in the DB and only resolving ``video_url`` once the task
  reaches ``succeeded``.
* ``MockVideoProvider`` is the local-dev escape hatch — selected automatically
  under ``MOCK_MODE`` or ``VIDEO_PROVIDER=mock`` so ``POST /v1/renders`` still
  works without a real Ark key.

Provider selection is config-driven via the ``get_video_provider`` factory.
"""

from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

import httpx

from app.config import settings
from app.schemas.video import TaskStatus, VideoGenRequest, VideoGenResult

# Ark task status → normalised TaskStatus.
_ARK_STATUS_MAP: dict[str, TaskStatus] = {
    "queued": TaskStatus.pending,
    "pending": TaskStatus.pending,
    "running": TaskStatus.running,
    "processing": TaskStatus.running,
    "succeeded": TaskStatus.succeeded,
    "success": TaskStatus.succeeded,
    "failed": TaskStatus.failed,
    "error": TaskStatus.failed,
    "cancelled": TaskStatus.failed,
    "canceled": TaskStatus.failed,
}


@runtime_checkable
class VideoProvider(Protocol):
    async def submit(self, req: VideoGenRequest) -> str:
        """Submit a generation task. Returns the provider task id."""

    async def poll(self, task_id: str) -> VideoGenResult:
        """Query a task's current state / resolved video url."""


def _resolution_and_ratio(width: int, height: int) -> tuple[str, str]:
    """Map pixel dimensions to Ark's ``resolution`` + ``ratio`` vocabulary."""
    if height >= 1080:
        resolution = "1080p"
    elif height >= 720:
        resolution = "720p"
    else:
        resolution = "480p"

    ratio = width / height if height else 0
    if 1.30 <= ratio <= 1.85:
        ratio_name = "16:9"
    elif 0.55 <= ratio < 0.75:
        ratio_name = "9:16"
    elif 0.95 <= ratio < 1.05:
        ratio_name = "1:1"
    elif 1.25 <= ratio < 1.30:
        ratio_name = "4:3"
    elif 0.75 <= ratio < 0.80:
        ratio_name = "3:4"
    elif ratio >= 2.20:
        ratio_name = "21:9"
    else:
        ratio_name = "16:9"
    return resolution, ratio_name


def _extract_error(error_obj: object) -> str:
    """Best-effort human-readable error from Ark's opaque error payload."""
    if error_obj is None:
        return ""
    if isinstance(error_obj, str):
        return error_obj
    if isinstance(error_obj, dict):
        msg = error_obj.get("message") or error_obj.get("code") or error_obj.get("msg")
        if msg:
            return str(msg)
    return str(error_obj)


class ArkSeedanceProvider:
    """Direct Volcano Engine Ark Seedance client (contents/generations/tasks).

    Only raises ``RuntimeError`` on *response-parse* failures (Ark returned a
    structure we don't recognise). Transport/HTTP errors surface via httpx and
    are caught by the router, which maps them to its own escape hatch.
    """

    def __init__(
        self, model: str | None = None, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._model = model or settings.ark_video_model
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {settings.ark_api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
            transport=transport,
        )

    @property
    def base_url(self) -> str:
        return settings.ark_base_url.rstrip("/")

    async def submit(self, req: VideoGenRequest) -> str:
        if not settings.ark_api_key:
            raise RuntimeError(
                "ARK_API_KEY not configured — set ARK_API_KEY (or VIDEO_PROVIDER=mock for local dev)"
            )

        extra = dict(req.extra)
        model = extra.pop("model", None) or self._model
        resolution, ratio = _resolution_and_ratio(req.width, req.height)

        payload: dict = {
            "model": model,
            "content": [{"type": "text", "text": req.prompt}],
            "resolution": resolution,
            "ratio": ratio,
            "duration": req.duration,
            "watermark": False,
        }
        if req.seed is not None:
            payload["seed"] = req.seed
        payload.update(extra)

        url = f"{self.base_url}/contents/generations/tasks"
        resp = await self._client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        task_id = data.get("id") if isinstance(data, dict) else None
        if not task_id:
            raise RuntimeError(f"ARK video unexpected submit response: {data}")
        return str(task_id)

    async def poll(self, task_id: str) -> VideoGenResult:
        url = f"{self.base_url}/contents/generations/tasks/{task_id}"
        resp = await self._client.get(url)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            raise RuntimeError(f"ARK video unexpected poll response: {data}")

        raw_status = str(data.get("status", ""))
        status = _ARK_STATUS_MAP.get(raw_status, TaskStatus.pending)

        video_url: str | None = None
        error: str | None = None

        if status is TaskStatus.succeeded:
            video_url = _extract_video_url(data.get("content"))
        elif status is TaskStatus.failed:
            error = _extract_error(data.get("error")) or "video generation failed"

        return VideoGenResult(task_id=task_id, status=status, video_url=video_url, error=error)

    async def close(self) -> None:
        await self._client.aclose()


def _extract_video_url(content: object) -> str | None:
    """Ark wraps the output in ``content`` — either ``{video_url: ...}`` or a list."""
    if isinstance(content, dict):
        url = content.get("video_url")
        return str(url) if url else None
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("video_url"):
                return str(item["video_url"])
    return None


class MockVideoProvider:
    """Local-dev escape hatch: submits nothing, reports a fixed idle task.

    ``submit`` returns an empty string so the router falls back to ``queued``
    (preserving the pre-existing MOCK branch behaviour).
    """

    async def submit(self, req: VideoGenRequest) -> str:
        return ""

    async def poll(self, task_id: str) -> VideoGenResult:
        return VideoGenResult(task_id=task_id, status=TaskStatus.pending)


def get_video_provider() -> VideoProvider:
    """Factory: select the active provider from config / env.

    MOCK_MODE (or an explicit ``VIDEO_PROVIDER=mock``) selects the mock
    provider so local dev and tests never touch real Ark.
    """
    if os.environ.get("MOCK_MODE") == "true" or settings.video_provider == "mock":
        return MockVideoProvider()
    return ArkSeedanceProvider()
