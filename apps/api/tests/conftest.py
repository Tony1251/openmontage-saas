"""Pytest fixtures with mocked DB and MCP."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db import get_db
from app.auth import generate_api_key, hash_secret


@pytest.fixture
def fake_api_key():
    public, full = generate_api_key("test")
    return public, full, hash_secret(full.removeprefix("sk_test_"))


@pytest.fixture
async def client(fake_api_key):
    public, full, _ = fake_api_key
    # Mock get_db to return in-memory session
    mock_session = AsyncMock()
    async def override_get_db():
        yield mock_session
    app.dependency_overrides[get_db] = override_get_db
    # Mock MCP client
    with patch("app.routers.renders.get_mcp") as mock_mcp:
        mock_mcp.return_value.submit_video_render = AsyncMock(return_value="ark_test_123")
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            ac.headers["Authorization"] = f"Bearer {full}"
            yield ac
    app.dependency_overrides.clear()
