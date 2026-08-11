from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict


class CreateApiKeyRequest(BaseModel):
    label: str = Field(min_length=1, max_length=64)


class CreateApiKeyResponse(BaseModel):
    id: int
    public_key: str
    full_key: str
    label: str | None = None
    created_at: str = ""


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    workspace_id: int
    public_key: str
    label: str | None = None
    status: str = "active"
    last_used_at: str | None = None
    created_at: str = ""


class ApiKeyWithSecret(ApiKeyResponse):
    secret: str = ""
