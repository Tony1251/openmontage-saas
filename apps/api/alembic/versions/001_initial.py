"""Create all 9 tables.

Revision ID: 001
Revises:
Create Date: 2026-07-27 09:00:00.000000+08:00
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──
    plan_enum = postgresql.ENUM("free", "pro", "enterprise", name="plan", create_type=False)
    plan_enum.create(op.get_bind(), checkfirst=True)
    render_status_enum = postgresql.ENUM(
        "queued", "running", "succeeded", "failed", "cancelled",
        name="render_status", create_type=False,
    )
    render_status_enum.create(op.get_bind(), checkfirst=True)
    api_key_status_enum = postgresql.ENUM(
        "active", "revoked",
        name="api_key_status", create_type=False,
    )
    api_key_status_enum.create(op.get_bind(), checkfirst=True)

    # ── users ──
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("clerk_user_id", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id"),
        sa.UniqueConstraint("email"),
    )

    # ── workspaces ──
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("plan", plan_enum, nullable=False, server_default=sa.text("'free'")),
        sa.Column("stripe_customer_id", sa.String(length=64), nullable=True),
        sa.Column("monthly_render_quota", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("stripe_customer_id"),
    )
    op.create_index("workspaces_owner_idx", "workspaces", ["owner_id"])

    # ── workspace_members ──
    op.create_table(
        "workspace_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False, server_default=sa.text("'member'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "user_id", name="workspace_members_unique"),
    )

    # ── api_keys ──
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("public_key", sa.String(length=32), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("status", api_key_status_enum, nullable=False, server_default=sa.text("'active'")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_key"),
    )
    op.create_index("api_keys_workspace_idx", "api_keys", ["workspace_id"])

    # ── renders (with extra_metadata JSONB instead of metadata) ──
    op.create_table(
        "renders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("api_key_id", sa.Integer(), nullable=True),
        sa.Column("ark_task_id", sa.String(length=128), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False, server_default=sa.text("'doubao-seedance-2-0-260128'")),
        sa.Column("duration_sec", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("resolution", sa.String(length=16), nullable=False, server_default=sa.text("'720p'")),
        sa.Column("status", render_status_enum, nullable=False, server_default=sa.text("'queued'")),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("cost_cents", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("extra_metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"], ondelete="set null"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("renders_workspace_status_idx", "renders", ["workspace_id", "status"])
    op.create_index("renders_ark_task_idx", "renders", ["ark_task_id"])

    # ── quota_usage ──
    op.create_table(
        "quota_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("renders_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("api_calls_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "period_start", name="quota_usage_unique"),
    )

    # ── subscriptions ──
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(length=64), nullable=False),
        sa.Column("stripe_price_id", sa.String(length=64), nullable=False),
        sa.Column("plan", plan_enum, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id"),
        sa.UniqueConstraint("stripe_subscription_id"),
    )

    # ── webhook_endpoints ──
    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("secret", sa.String(length=64), nullable=False),
        sa.Column("events", postgresql.JSONB, nullable=False, server_default=sa.text("'[\"render.succeeded\",\"render.failed\"]'::jsonb")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── audit_log ──
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=True),
        sa.Column("api_key_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=True),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("extra_metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="set null"),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"], ondelete="set null"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("audit_workspace_created_idx", "audit_log", ["workspace_id", "created_at"])


def downgrade() -> None:
    op.drop_index("audit_workspace_created_idx", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("webhook_endpoints")
    op.drop_table("subscriptions")
    op.drop_table("quota_usage")
    op.drop_index("renders_workspace_status_idx", table_name="renders")
    op.drop_index("renders_ark_task_idx", table_name="renders")
    op.drop_table("renders")
    op.drop_index("api_keys_workspace_idx", table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_table("workspace_members")
    op.drop_index("workspaces_owner_idx", table_name="workspaces")
    op.drop_table("workspaces")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS api_key_status")
    op.execute("DROP TYPE IF EXISTS render_status")
    op.execute("DROP TYPE IF EXISTS plan")
