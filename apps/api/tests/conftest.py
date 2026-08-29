"""Pytest fixtures: in-memory SQLite DB + MOCK_MODE auth + stubbed providers.

Tests run the real auth path in MOCK_MODE (bypasses Bearer lookup) and the
real DB layer against SQLite — no Postgres needed for CI/dev.

The video and vision providers are stubbed via ``dependency_overrides`` so no
real Ark key / network is ever hit.
"""

from __future__ import annotations

import os

# Must be set before any app import (config.Settings is module-level).
os.environ.setdefault("MOCK_MODE", "true")

import pytest
import sqlalchemy as sa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_db
from app.main import app
from app.models import Base
from app.services.ark_vision import get_ark_vision
from app.services.video_provider import get_video_provider


@pytest.fixture
async def db_session():
    """Fresh in-memory SQLite schema per test, seeded with the MOCK_MODE workspace."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Seed a workspace row (id=1) matching the MOCK_MODE synthetic auth
        # context so the credit-ledger debit/refund have a real row to update.
        await conn.execute(
            sa.text(
                "INSERT INTO workspaces "
                "(id, owner_id, name, slug, plan, monthly_render_quota, credits_balance_units) "
                "VALUES (1, 0, 'Mock Workspace', 'mock', 'free', 10, 40)"
            )
        )
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session
    await engine.dispose()


class StubVideoProvider:
    """Fake ``VideoProvider``: submit returns a fixed task id, poll is a no-op."""

    async def submit(self, req):
        return "ark_test_123"

    async def poll(self, task_id):
        from app.schemas.video import TaskStatus, VideoGenResult

        return VideoGenResult(task_id=task_id, status=TaskStatus.pending)


class StubArkVision:
    async def analyze(self, image_url, prompt, model=None):
        return f"[vision] {prompt} :: {image_url}"


@pytest.fixture
async def client(db_session):
    """HTTP client with DB overridden to SQLite and providers stubbed.

    MOCK_MODE=true means get_auth returns the synthetic workspace — no
    Authorization header needed, but we accept one if provided.
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_video_provider] = lambda: StubVideoProvider()
    app.dependency_overrides[get_ark_vision] = lambda: StubArkVision()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
