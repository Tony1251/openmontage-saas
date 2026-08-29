from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CreateRenderRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    model: str = "doubao-seedance-2-0-260128"
    duration_sec: Literal[5, 10] = 5
    resolution: Literal["480p", "720p", "1080p"] = "720p"
    extra_metadata: dict | None = None


class RenderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workspace_id: int
    ark_task_id: str | None
    prompt: str
    model: str
    duration_sec: int
    resolution: str
    status: str
    video_url: str | None
    error: str | None
    cost_cents: int
    credits_consumed_units: int = 0
    extra_metadata: dict | None
    created_at: str
    completed_at: str | None
