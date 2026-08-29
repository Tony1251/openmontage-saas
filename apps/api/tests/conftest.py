"""Pytest fixtures: in-memory SQLite DB + MOCK_MODE auth + stubbed MCP.

Tests run the real auth path in MOCK_MODE (bypasses Bearer lookup) and the
real DB layer against SQLite — no Postgres needed for CI/dev.
"""
from __future__ import annotations

import os

# Must be set before any app import (config.Settings is module-level).
os.environ.setdefault("MOCK_MODE", "true")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_db
from app.main import app
from app.models import Base
from app.services.openmontage import get_mcp


@pytest.fixture
async def db_session():
    """Fresh in-memory SQLite schema per test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    """HTTP client with DB overridden to SQLite and MCP stubbed.

    MOCK_MODE=true means get_auth returns the synthetic workspace — no
    Authorization header needed, but we accept one if provided.
    """

    async def override_get_db():
        yield db_session

    class _StubMCP:
        async def submit_video_render(self, **kwargs):
            return "ark_test_123"

        async def list_tools(self):
            return [{"name": "ark_seedance_video"}]

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_mcp] = lambda: _StubMCP()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
