from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ── Enums ──


class Plan(str, PyEnum):
    free = "free"
    pro = "pro"
    business = "business"
    enterprise = "enterprise"


class RenderStatus(str, PyEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class ApiKeyStatus(str, PyEnum):
    active = "active"
    revoked = "revoked"


class CreditTxnType(str, PyEnum):
    grant = "grant"
    subscription = "subscription"
    usage = "usage"
    refund = "refund"
    admin_adjust = "admin_adjust"


# ── Users (Clerk mirror) ──


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clerk_user_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    owned_workspaces: Mapped[list[Workspace]] = relationship(
        "Workspace", back_populates="owner", foreign_keys="Workspace.owner_id"
    )
    memberships: Mapped[list[WorkspaceMember]] = relationship(
        "WorkspaceMember", back_populates="user"
    )


# ── Workspaces ──


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    plan: Mapped[Plan] = mapped_column(
        Enum(Plan, name="plan"), nullable=False, server_default=text("'free'")
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    monthly_render_quota: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("10")
    )
    credits_balance_units: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (Index("workspaces_owner_idx", "owner_id"),)

    owner: Mapped[User] = relationship(
        "User", back_populates="owned_workspaces", foreign_keys=[owner_id]
    )
    members: Mapped[list[WorkspaceMember]] = relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan"
    )
    api_keys: Mapped[list[ApiKey]] = relationship(
        "ApiKey", back_populates="workspace", cascade="all, delete-orphan"
    )
    renders: Mapped[list[Render]] = relationship(
        "Render", back_populates="workspace", cascade="all, delete-orphan"
    )
    quota_usage: Mapped[list[QuotaUsage]] = relationship(
        "QuotaUsage", back_populates="workspace", cascade="all, delete-orphan"
    )
    credit_transactions: Mapped[list[CreditTransaction]] = relationship(
        "CreditTransaction", back_populates="workspace", cascade="all, delete-orphan"
    )
    subscription: Mapped[Subscription | None] = relationship(
        "Subscription", back_populates="workspace", uselist=False, cascade="all, delete-orphan"
    )
    webhook_endpoints: Mapped[list[WebhookEndpoint]] = relationship(
        "WebhookEndpoint", back_populates="workspace", cascade="all, delete-orphan"
    )


# ── Workspace Members ──


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="cascade"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False, server_default=text("'member'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="workspace_members_unique"),)

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="members")
    user: Mapped[User] = relationship("User", back_populates="memberships")


# ── API Keys ──


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    public_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ApiKeyStatus] = mapped_column(
        Enum(ApiKeyStatus, name="api_key_status"), nullable=False, server_default=text("'active'")
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("api_keys_workspace_idx", "workspace_id"),)

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="api_keys")
    renders: Mapped[list[Render]] = relationship("Render", back_populates="api_key")


# ── Renders ──


class Render(Base):
    __tablename__ = "renders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    api_key_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("api_keys.id", ondelete="set null"), nullable=True
    )
    ark_task_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default=text("'doubao-seedance-2-0-260128'")
    )
    duration_sec: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))
    resolution: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'720p'")
    )
    status: Mapped[RenderStatus] = mapped_column(
        Enum(RenderStatus, name="render_status"), nullable=False, server_default=text("'queued'")
    )
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_cents: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    credits_consumed_units: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    extra_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, name="extra_metadata", nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("renders_workspace_status_idx", "workspace_id", "status"),
        Index("renders_ark_task_idx", "ark_task_id"),
    )

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="renders")
    api_key: Mapped[ApiKey | None] = relationship("ApiKey", back_populates="renders")


# ── Credit ledger (docs/PRICING.md §4) ──


class CreditTransaction(Base):
    """Append-only ledger of signed credit movements.

    ``amount_units`` is signed (+grant/subscription/refund, -usage). The
    denormalised ``Workspace.credits_balance_units`` is maintained inside the
    same DB transaction as each row, so balance always equals the running sum.

    Idempotency is enforced by the unique ``(idempotency_key, type)`` pair: a
    usage debit and its matching refund share one ``idempotency_key`` but differ
    by ``type``, guaranteeing each lands at most once (net = 0 on retries).
    """

    __tablename__ = "credit_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    amount_units: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[CreditTxnType] = mapped_column(
        Enum(CreditTxnType, name="credit_txn_type"), nullable=False
    )
    ref_render_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("renders.id", ondelete="set null"), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("idempotency_key", "type", name="uq_credit_idem_type"),
        Index("credit_txns_workspace_idx", "workspace_id"),
    )

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="credit_transactions")
    render: Mapped[Render | None] = relationship("Render")


# ── Quota Usage (monthly aggregates) ──


class QuotaUsage(Base):
    __tablename__ = "quota_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    renders_used: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    api_calls_used: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("workspace_id", "period_start", name="quota_usage_unique"),)

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="quota_usage")


# ── Subscriptions (Stripe mirror) ──


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), unique=True, nullable=False
    )
    stripe_subscription_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    stripe_price_id: Mapped[str] = mapped_column(String(64), nullable=False)
    plan: Mapped[Plan] = mapped_column(Enum(Plan, name="plan"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="subscription")


# ── Webhook Endpoints ──


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="cascade"), nullable=False
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    secret: Mapped[str] = mapped_column(String(64), nullable=False)
    events: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=lambda: ["render.succeeded", "render.failed"]
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    workspace: Mapped[Workspace] = relationship("Workspace", back_populates="webhook_endpoints")


# ── Audit Log ──


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("workspaces.id", ondelete="set null"), nullable=True
    )
    api_key_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("api_keys.id", ondelete="set null"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, name="extra_metadata", nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (Index("audit_workspace_created_idx", "workspace_id", "created_at"),)
