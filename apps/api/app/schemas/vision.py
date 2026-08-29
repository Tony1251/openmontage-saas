from __future__ import annotations

from pydantic import BaseModel, Field


class VisionAnalyzeRequest(BaseModel):
    image_url: str = Field(min_length=1, max_length=2048)
    prompt: str = Field(min_length=1, max_length=2000)
    model: str | None = None


class VisionAnalyzeResponse(BaseModel):
    result: str
