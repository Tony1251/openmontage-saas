"""Credit ledger service (docs/PRICING.md §1, §4, §5).

All balances and amounts are **integer units** — never float. The denormalised
``Workspace.credits_balance_units`` is maintained atomically in the same DB
transaction as each ``CreditTransaction`` row.

Concurrency safety: ``debit_units`` uses a conditional ``UPDATE ... WHERE
balance >= units`` so two simultaneous debits on the same workspace can never
drive the balance negative (oversell-proof under row locking).

Idempotency: the ledger's unique ``(idempotency_key, type)`` pair ensures a
usage debit and its matching refund each land exactly once, so a retried
request nets to zero.
"""

from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CreditTransaction, CreditTxnType, Workspace

# resolution → integer units consumed per second (PRICING.md §1).
RESOLUTION_UNITS_PER_SEC: dict[str, int] = {
    "480p": 1,
    "720p": 2,
    "1080p": 5,
}
DEFAULT_UNITS_PER_SEC = 2  # 720p fallback for unknown resolution tokens.


class InsufficientCreditsError(Exception):
    """Raised when balance < required. Carries the structured 402 body fields."""

    def __init__(self, required: int, available: int) -> None:
        self.required = required
        self.available = available
        super().__init__(f"insufficient credits: need {required}, have {available}")


def units_for(resolution: str, duration_sec: int) -> int:
    """Integer units a render consumes = resolution units/sec × duration (sec)."""
    per_sec = RESOLUTION_UNITS_PER_SEC.get(resolution, DEFAULT_UNITS_PER_SEC)
    return per_sec * max(0, int(duration_sec))


async def get_balance(db: AsyncSession, workspace_id: int) -> int:
    result = await db.execute(
        select(Workspace.credits_balance_units).where(Workspace.id == workspace_id)
    )
    return result.scalar_one_or_none() or 0


async def _already_recorded(
    db: AsyncSession, idempotency_key: str, txn_type: CreditTxnType
) -> bool:
    result = await db.execute(
        select(CreditTransaction.id).where(
            CreditTransaction.idempotency_key == idempotency_key,
            CreditTransaction.type == txn_type,
        )
    )
    return result.scalar_one_or_none() is not None


async def debit_units(
    db: AsyncSession,
    workspace_id: int,
    units: int,
    idempotency_key: str,
    ref_render_id: int | None = None,
) -> None:
    """Atomically debit ``units`` (oversell-safe), recording a ``usage`` row.

    Raises ``InsufficientCredits`` if the balance would go negative. No-op when
    the same (key, usage) debit has already been recorded.
    """
    if units <= 0:
        return
    if await _already_recorded(db, idempotency_key, CreditTxnType.usage):
        return

    result = await db.execute(
        update(Workspace)
        .where(Workspace.id == workspace_id, Workspace.credits_balance_units >= units)
        .values(credits_balance_units=Workspace.credits_balance_units - units)
        .returning(Workspace.credits_balance_units)
    )
    new_balance = result.scalar_one_or_none()
    if new_balance is None:
        available = await get_balance(db, workspace_id)
        raise InsufficientCreditsError(required=units, available=available)

    db.add(
        CreditTransaction(
            workspace_id=workspace_id,
            amount_units=-units,
            type=CreditTxnType.usage,
            ref_render_id=ref_render_id,
            idempotency_key=idempotency_key,
        )
    )


async def refund_units(
    db: AsyncSession,
    workspace_id: int,
    units: int,
    idempotency_key: str,
    ref_render_id: int | None = None,
) -> None:
    """Idempotently credit ``units`` back (submit-failure refund)."""
    if units <= 0:
        return
    if await _already_recorded(db, idempotency_key, CreditTxnType.refund):
        return

    await db.execute(
        update(Workspace)
        .where(Workspace.id == workspace_id)
        .values(credits_balance_units=Workspace.credits_balance_units + units)
    )
    db.add(
        CreditTransaction(
            workspace_id=workspace_id,
            amount_units=units,
            type=CreditTxnType.refund,
            ref_render_id=ref_render_id,
            idempotency_key=idempotency_key,
        )
    )


async def grant_units(
    db: AsyncSession,
    workspace_id: int,
    units: int,
    idempotency_key: str,
    txn_type: CreditTxnType = CreditTxnType.grant,
) -> None:
    """Idempotently credit ``units`` (signup grant / subscription top-up)."""
    if units <= 0:
        return
    if await _already_recorded(db, idempotency_key, txn_type):
        return

    await db.execute(
        update(Workspace)
        .where(Workspace.id == workspace_id)
        .values(credits_balance_units=Workspace.credits_balance_units + units)
    )
    db.add(
        CreditTransaction(
            workspace_id=workspace_id,
            amount_units=units,
            type=txn_type,
            ref_render_id=None,
            idempotency_key=idempotency_key,
        )
    )
