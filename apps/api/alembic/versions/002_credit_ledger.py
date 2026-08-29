"""Add credit ledger: credit_txn_type enum, credit_transactions table, balance columns.

Revision ID: 002
Revises: 001
Create Date: 2026-08-29 00:00:00.000000+00:00

Implements docs/PRICING.md §4:
- ``plan`` enum gains ``business``.
- New ``credit_txn_type`` enum (grant/subscription/usage/refund/admin_adjust).
- ``workspaces.credits_balance_units`` (denormalised, non-negative, integer).
- ``renders.credits_consumed_units`` (settled units at creation).
- ``credit_transactions`` append-only ledger with unique ``(idempotency_key, type)``.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── plan enum: add `business` (Postgres 12+; autocommit avoids the
    #    "cannot add enum value inside transaction" restriction) ──
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE plan ADD VALUE IF NOT EXISTS 'business'")

    # ── credit_txn_type enum ──
    credit_txn_type = postgresql.ENUM(
        "grant",
        "subscription",
        "usage",
        "refund",
        "admin_adjust",
        name="credit_txn_type",
        create_type=False,
    )
    credit_txn_type.create(op.get_bind(), checkfirst=True)

    # ── workspaces.credits_balance_units ──
    op.add_column(
        "workspaces",
        sa.Column(
            "credits_balance_units",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # ── renders.credits_consumed_units ──
    op.add_column(
        "renders",
        sa.Column(
            "credits_consumed_units",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # ── credit_transactions ──
    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("amount_units", sa.Integer(), nullable=False),
        sa.Column("type", credit_txn_type, nullable=False),
        sa.Column("ref_render_id", sa.Integer(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.ForeignKeyConstraint(["ref_render_id"], ["renders.id"], ondelete="set null"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", "type", name="uq_credit_idem_type"),
    )
    op.create_index("credit_txns_workspace_idx", "credit_transactions", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("credit_txns_workspace_idx", table_name="credit_transactions")
    op.drop_table("credit_transactions")
    op.drop_column("renders", "credits_consumed_units")
    op.drop_column("workspaces", "credits_balance_units")
    op.execute("DROP TYPE IF EXISTS credit_txn_type")
    # NOTE: `plan` enum value 'business' is intentionally left in place — Postgres
    # cannot safely remove an enum value that may be referenced by existing rows.
