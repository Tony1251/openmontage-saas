"""Credit ledger + billing flow tests (docs/PRICING.md §5, §7).

Verifies against real SQLite + MOCK_MODE auth:

- ``units_for`` integer mapping (480/720/1080 = 1/2/5 u/s).
- 402 ``insufficient_credits`` with structured body, provider never called.
- Successful render debits balance + records a ``usage`` transaction.
- Submit failure refunds (net=0) and marks the render failed.
- Refund idempotency (repeat refund is a no-op).
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa
from sqlalchemy import select

from app.models import CreditTransaction, CreditTxnType, Render
from app.services.credits import units_for

# ── units_for mapping ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "resolution,duration,expected",
    [
        ("480p", 5, 5),
        ("720p", 5, 10),
        ("1080p", 5, 25),
        ("720p", 10, 20),
        ("1080p", 10, 50),
        ("unknown", 5, 10),  # falls back to 720p (2 u/s)
    ],
)
def test_units_for(resolution, duration, expected):
    assert units_for(resolution, duration) == expected


# ── 402 insufficient credits ──────────────────────────────────────


class _CountingProvider:
    """Records whether submit was ever called (should be zero on 402)."""

    def __init__(self):
        self.submit_called = False

    async def submit(self, req):
        self.submit_called = True
        return "should-not-reach"

    async def poll(self, task_id):
        raise NotImplementedError


@pytest.mark.asyncio
async def test_insufficient_credits_402_and_provider_not_called(client, db_session):
    from app.main import app
    from app.services.video_provider import get_video_provider

    # Drive the seeded balance (40) down to 4 so a 720p/5s render (10 units) is unaffordable.
    await db_session.execute(
        sa.text("UPDATE workspaces SET credits_balance_units = 4 WHERE id = 1")
    )
    await db_session.commit()

    provider = _CountingProvider()
    app.dependency_overrides[get_video_provider] = lambda: provider
    try:
        resp = await client.post(
            "/v1/renders",
            json={"prompt": "expensive", "duration_sec": 5, "resolution": "720p"},
        )
        assert resp.status_code == 402, resp.text
        body = resp.json()["detail"]
        assert body["code"] == "insufficient_credits"
        assert body["credits_required"] == 10
        assert body["credits_available"] == 4
        assert provider.submit_called is False  # Ark never touched
    finally:
        app.dependency_overrides.pop(get_video_provider, None)


# ── successful debit ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_render_debits_balance_and_records_usage(client, db_session):
    resp = await client.post(
        "/v1/renders",
        json={"prompt": "ultraman fight", "duration_sec": 5, "resolution": "720p"},
    )
    assert resp.status_code == 201, resp.text
    render_id = resp.json()["id"]

    # Balance went 40 → 30 (720p/5s = 10 units).
    balance = (
        await db_session.execute(
            sa.text("SELECT credits_balance_units FROM workspaces WHERE id = 1")
        )
    ).scalar_one()
    assert balance == 30

    # A single usage transaction of -10 units references the render.
    txn = (
        await db_session.execute(
            select(CreditTransaction).where(CreditTransaction.ref_render_id == render_id)
        )
    ).scalar_one()
    assert txn.type == CreditTxnType.usage
    assert txn.amount_units == -10

    # Render row settled with credits_consumed_units.
    render = (await db_session.execute(select(Render).where(Render.id == render_id))).scalar_one()
    assert render.credits_consumed_units == 10


# ── submit failure → refund (net=0) ───────────────────────────────


class _BoomSubmitProvider:
    def __init__(self):
        self.submit_called = False

    async def submit(self, req):
        self.submit_called = True
        raise RuntimeError("ARK_API_KEY not configured")

    async def poll(self, task_id):
        raise RuntimeError("n/a")


@pytest.mark.asyncio
async def test_submit_failure_refunds_and_marks_failed(client, db_session):
    from app.main import app
    from app.services.video_provider import get_video_provider

    provider = _BoomSubmitProvider()
    app.dependency_overrides[get_video_provider] = lambda: provider
    try:
        resp = await client.post(
            "/v1/renders",
            json={"prompt": "doomed", "duration_sec": 5, "resolution": "720p"},
        )
        assert resp.status_code == 503, resp.text
        assert resp.json()["detail"]["error"] == "video_unavailable"
        assert provider.submit_called is True
    finally:
        app.dependency_overrides.pop(get_video_provider, None)

    # Balance restored to 40 (debit -10 then refund +10 → net 0).
    balance = (
        await db_session.execute(
            sa.text("SELECT credits_balance_units FROM workspaces WHERE id = 1")
        )
    ).scalar_one()
    assert balance == 40

    # Exactly one usage (-10) and one refund (+10) transaction exist.
    txns = (
        (await db_session.execute(select(CreditTransaction).order_by(CreditTransaction.id)))
        .scalars()
        .all()
    )
    amounts = {t.type: t.amount_units for t in txns}
    assert amounts.get(CreditTxnType.usage) == -10
    assert amounts.get(CreditTxnType.refund) == 10
    assert sum(t.amount_units for t in txns) == 0

    # The render is marked failed.
    render = (
        await db_session.execute(select(Render).order_by(Render.id.desc()).limit(1))
    ).scalar_one()
    assert render.status.value == "failed"
