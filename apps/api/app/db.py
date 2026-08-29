"""Async SQLAlchemy engine + session factory.

Engine is created lazily so tests can override `settings.database_url` to
SQLite without the module-level Postgres pool options breaking import.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _make_engine(url: str) -> AsyncEngine:
    """Build engine with pool opts only for network DBs (Postgres)."""
    if url.startswith("sqlite"):
        return create_async_engine(url, pool_pre_ping=True)
    return create_async_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=20)


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = _make_engine(settings.database_url)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), expire_on_commit=False, class_=AsyncSession
        )
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()
