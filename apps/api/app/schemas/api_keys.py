from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict


class CreateApiKeyRequest(BaseModel):
    label: str = Field(min_length=1, max_length=64)


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workspace_id: int
    public_key: str
    label: str | None
    status: str
    last_used_at: str | None
    created_at: str


class ApiKeyWithSecret(ApiKeyResponse):
    secret: str
