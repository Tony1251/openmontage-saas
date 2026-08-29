"""Pytest fixtures: DB + MOCK_MODE auth + stubbed providers.

Tests run the real auth path in MOCK_MODE (bypasses Bearer lookup) and the
real DB layer. By default the DB is in-memory SQLite (fast, no server needed);
setting ``TEST_DATABASE_URL`` runs the same suite against a real Postgres —
CI uses this to exercise true row-lock semantics for the concurrent-debit test.

The video and vision providers are stubbed via ``dependency_overrides`` so no
real Ark key / network is ever hit.
"""

from __future__ import annotations

import os

# Must be set before any app import (config.Settings is module-level).
os.environ.setdefault("MOCK_MODE", "true")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_db
from app.main import app
from app.models import ApiKey, ApiKeyStatus, Base, Plan, User, Workspace
from app.services.ark_vision import get_ark_vision
from app.services.video_provider import get_video_provider

# Default SQLite in-memory; CI sets TEST_DATABASE_URL to point at Postgres.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


def _make_test_engine():
    if TEST_DATABASE_URL.startswith("postgresql"):
        # A real pool so the concurrent-debit test gets genuinely parallel
        # connections (SQLite :memory: uses a single shared connection, which
        # serialises the two debits and hides the row-lock race).
        return create_async_engine(
            TEST_DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20
        )
    return create_async_engine(TEST_DATABASE_URL, pool_pre_ping=True)


def _create_schema(sync_conn):
    Base.metadata.create_all(sync_conn)


def _seed(sync_conn):
    """Seed the rows the MOCK_MODE auth context (``app.auth._get_mock_context``)
    references: ``users`` (id=1), ``workspaces`` (id=1) and ``api_keys`` (id=1).

    Uses Core ``insert`` with enum members rather than raw SQL so the seed is
    FK-safe (Postgres enforces ``workspaces.owner_id -> users.id`` and
    ``renders.api_key_id -> api_keys.id``, SQLite does not) and enum-safe
    (asyncpg maps enum members to the native PG type).
    """
    sync_conn.execute(
        insert(User).values(
            id=1,
            clerk_user_id="mock-user",
            email="mock@example.com",
            name="Mock User",
        )
    )
    sync_conn.execute(
        insert(Workspace).values(
            id=1,
            owner_id=1,
            name="Mock Workspace",
            slug="mock",
            plan=Plan.free,
            monthly_render_quota=10,
            credits_balance_units=40,
        )
    )
    sync_conn.execute(
        insert(ApiKey).values(
            id=1,
            workspace_id=1,
            public_key="sk_test_mock0000",
            key_hash="0" * 64,
            label="mock-key",
            status=ApiKeyStatus.active,
        )
    )


@pytest.fixture
async def db_session():
    """Fresh schema per test, seeded with the MOCK_MODE workspace."""
    engine = _make_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(_create_schema)
        await conn.run_sync(_seed)
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
    """HTTP client with DB overridden to the test DB and providers stubbed.

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
