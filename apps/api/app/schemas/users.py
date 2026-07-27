from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str | None = None
    avatar_url: str | None = None
    created_at: str = ""
    updated_at: str = ""


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
