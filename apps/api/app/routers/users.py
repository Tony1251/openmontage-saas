from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.auth import get_auth, AuthContext
from app.db import get_db
from app.models import User, Workspace, WorkspaceMember
from app.schemas.users import UserResponse, UpdateUserRequest

router = APIRouter(tags=["users"])


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


@router.get("/users/me")
async def get_me(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Return current user profile."""
    if auth.user and auth.user.id:
        result = await db.execute(select(User).where(User.id == auth.user.id))
        db_user = result.scalar_one_or_none()
        if db_user:
            return UserResponse(
                id=db_user.id,
                email=db_user.email,
                name=db_user.name,
                avatar_url=db_user.avatar_url,
                created_at=db_user.created_at.isoformat() if db_user.created_at else "",
                updated_at=db_user.updated_at.isoformat() if db_user.updated_at else "",
            )
    # In MOCK_MODE, get_auth may return a mock AuthContext with user=None.
    # Return a fake response so the frontend can work.
    import os
    if os.environ.get("MOCK_MODE") == "true":
        return UserResponse(
            id=1,
            email="mock@openmontage.dev",
            name="Mock User",
            avatar_url=None,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    raise HTTPException(status_code=404, detail={"error": "not_found", "message": "user not found"})


@router.patch("/users/me")
async def update_me(
    body: UpdateUserRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update current user profile."""
    import os
    if os.environ.get("MOCK_MODE") == "true":
        return UserResponse(
            id=1,
            email="mock@openmontage.dev",
            name=body.name or "Mock User",
            avatar_url=body.avatar_url,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    if not auth.user or not auth.user.id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "user not found"})
    result = await db.execute(select(User).where(User.id == auth.user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "user not found"})
    if body.name is not None:
        db_user.name = body.name
    if body.avatar_url is not None:
        db_user.avatar_url = body.avatar_url
    db_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_user)
    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        avatar_url=db_user.avatar_url,
        created_at=db_user.created_at.isoformat() if db_user.created_at else "",
        updated_at=db_user.updated_at.isoformat() if db_user.updated_at else "",
    )


@router.get("/users")
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    auth: Annotated[AuthContext, Depends(get_auth)],
) -> list[UserResponse]:
    """List users in the current workspace (mock: return all users)."""
    import os
    if os.environ.get("MOCK_MODE") == "true":
        return [
            UserResponse(
                id=1,
                email="mock@openmontage.dev",
                name="Mock User",
                avatar_url=None,
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
        ]
    result = await db.execute(
        select(User)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == auth.workspace.id)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            avatar_url=u.avatar_url,
            created_at=u.created_at.isoformat() if u.created_at else "",
            updated_at=u.updated_at.isoformat() if u.updated_at else "",
        )
        for u in users
    ]


@router.post("/users/sync", status_code=200)
async def sync_user(
    body: SyncUserRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SyncUserResponse:
    result = await db.execute(select(User).where(User.clerk_user_id == body.clerk_user_id))
    user = result.scalar_one_or_none()
    is_new = False

    if user:
        user.email = body.email
        if body.name is not None:
            user.name = body.name
        if body.avatar_url is not None:
            user.avatar_url = body.avatar_url
        await db.commit()
        await db.refresh(user)

        ws_result = await db.execute(
            select(Workspace).where(Workspace.owner_id == user.id).order_by(Workspace.created_at.asc()).limit(1)
        )
        ws = ws_result.scalar_one_or_none()
        return SyncUserResponse(id=user.id, clerk_user_id=user.clerk_user_id, email=user.email, workspace_id=ws.id if ws else None, is_new=False)
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
            monthly_render_quota=10,
        )
        db.add(workspace)
        await db.flush()

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
