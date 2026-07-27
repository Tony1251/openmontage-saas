"""Pytest fixtures with mocked DB and MCP."""
from __future__ import annotations
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas")
os.environ.setdefault("MCP_URL", "http://127.0.0.1:8765/mcp")
os.environ.setdefault("MCP_TOKEN", "test-token")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
os.environ.setdefault("STRIPE_PRICE_PRO", "price_pro_dummy")
os.environ.setdefault("STRIPE_PRICE_ENTERPRISE", "price_ent_dummy")
os.environ.setdefault("API_BASE_URL", "http://127.0.0.1:8000")
os.environ.setdefault("WEB_BASE_URL", "http://127.0.0.1:3001")
os.environ["MOCK_MODE"] = "true"

from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db import get_db


class MockResult:
    """A result-like object that chains .scalars() and .all() / .first() etc."""

    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar_val = scalar

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self):
        return self._scalar_val

    def one_or_none(self):
        return self._scalar_val


class MockSession:
    """A stateful mock DB session that tracks added objects."""

    def __init__(self):
        self._objects = []
        self._next_id = 1

    async def execute(self, query):
        """Return MockResult based on tracked objects.

        Crudely matches objects by extracting the WHERE clause conditions
        from the compiled query string for basic equality filters.
        """
        # Default: return no rows
        rows = []
        scalar = None

        compiled = str(query.compile(compile_kwargs={"literal_binds": True}))
        # Try to extract ApiKey by id
        if "api_keys" in compiled.lower() and "api_keys.id" in compiled.lower():
            # Match against tracked ApiKey objects
            for obj in self._objects:
                if hasattr(obj, 'id') and str(obj.id) in compiled:
                    rows.append(obj)
                    scalar = obj
                    break
        elif "quota_usage" in compiled.lower():
            # Match against tracked QuotaUsage
            scalar = 0  # default renders_used
            for obj in self._objects:
                if hasattr(obj, 'renders_used'):
                    scalar = obj.renders_used
                    rows.append(obj)
                    break
        elif "subscriptions" in compiled.lower():
            scalar = None

        return MockResult(rows=rows, scalar=scalar)

    def add(self, obj):
        self._objects.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        for obj in self._objects:
            if hasattr(obj, 'id') and obj.id is None:
                obj.id = self._next_id
                self._next_id += 1

    async def refresh(self, obj):
        if hasattr(obj, 'id') and obj.id is None:
            obj.id = self._next_id
            self._next_id += 1

    async def close(self):
        self._objects.clear()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass


@pytest.fixture
async def client():
    """ASGI test client with DB + MCP mocked. Auth bypassed via MOCK_MODE."""
    mock_session = MockSession()

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with patch("app.services.openmontage.get_mcp") as mock_mcp:
            mock_mcp.return_value.submit_video_render = AsyncMock(return_value="ark_test_123")
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac
    finally:
        app.dependency_overrides.clear()
