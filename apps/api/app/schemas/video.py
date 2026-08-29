"""Provider-neutral video-generation contract.

These models sit at the ``VideoProvider`` boundary (see
``app/services/video_provider.py``). They are provider-agnostic on purpose:
``ArkSeedanceProvider`` is the first concrete implementation, and a future
OpenMontage MCP provider can reuse the exact same types without touching the
router layer.

Validation lives entirely in Pydantic ``Field`` constraints so illegal inputs
are rejected at the FastAPI boundary (422) and a provider's ``submit`` never
receives dirty data.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Normalised terminal/non-terminal states shared across providers."""

    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class VideoGenRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    width: int = Field(default=1280, ge=64, le=1920)
    height: int = Field(default=720, ge=64, le=1920)
    duration: int = Field(default=5, ge=1, le=30)
    seed: int | None = Field(default=None, ge=0)
    extra: dict[str, Any] = Field(default_factory=dict)


class VideoGenResult(BaseModel):
    task_id: str
    status: TaskStatus
    video_url: str | None = None
    error: str | None = None
