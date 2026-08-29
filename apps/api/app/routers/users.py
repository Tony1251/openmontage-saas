from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import CreditTransaction, CreditTxnType, User, Workspace, WorkspaceMember

router = APIRouter(tags=["users"])

FREE_SIGNUP_CREDITS = 40  # docs/PRICING.md §2


class SyncUserRequest(BaseModel):
    clerk_user_id: str = Field(min_length=1, max_length=64)
    email: str = Field(min_length=1, max_length=255)
    name: str | None = None
    avatar_url: str | None = None


class SyncUserResponse(BaseModel):
    id: int
    clerk_user_id: str
    email: str
    workspace_id: int | None = None
    is_new: bool = False


@router.post("/users/sync", status_code=200)
async def sync_user(
    body: SyncUserRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SyncUserResponse:
    result = await db.execute(select(User).where(User.clerk_user_id == body.clerk_user_id))
    user = result.scalar_one_or_none()
    _is_new = False  # TODO: unused placeholder — decide if returned flag is needed

    if user:
        user.email = body.email
        if body.name is not None:
            user.name = body.name
        if body.avatar_url is not None:
            user.avatar_url = body.avatar_url
        await db.commit()
        await db.refresh(user)

        ws_result = await db.execute(
            select(Workspace)
            .where(Workspace.owner_id == user.id)
            .order_by(Workspace.created_at.asc())
            .limit(1)
        )
        ws = ws_result.scalar_one_or_none()
        return SyncUserResponse(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            email=user.email,
            workspace_id=ws.id if ws else None,
            is_new=False,
        )
    else:
        user = User(
            clerk_user_id=body.clerk_user_id,
            email=body.email,
            name=body.name,
            avatar_url=body.avatar_url,
        )
        db.add(user)
        await db.flush()

        slug = f"ws-{user.id}-{hash(body.clerk_user_id) % 10000:04d}"
        workspace = Workspace(
            owner_id=user.id,
            name=f"{body.name or body.email.split('@')[0]}'s Workspace",
            slug=slug,
            plan="free",
            credits_balance_units=FREE_SIGNUP_CREDITS,
        )
        db.add(workspace)
        await db.flush()

        # Free tier signup grant (PRICING.md §2: 40 units on registration).
        db.add(
            CreditTransaction(
                workspace_id=workspace.id,
                amount_units=FREE_SIGNUP_CREDITS,
                type=CreditTxnType.grant,
                idempotency_key=f"signup-{user.id}",
            )
        )

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
        )
        db.add(member)
        await db.commit()
        await db.refresh(user)

        return SyncUserResponse(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            email=user.email,
            workspace_id=workspace.id,
            is_new=True,
        )
