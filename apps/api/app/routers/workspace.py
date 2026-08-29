from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthContext, get_auth
from app.db import get_db
from app.models import Plan
from app.services.credits import get_balance

router = APIRouter(tags=["workspace"])


def _plan_str(plan: object) -> str:
    return plan.value if isinstance(plan, Plan) else str(plan)


@router.get("/workspace")
async def get_workspace(
    auth: Annotated[AuthContext, Depends(get_auth)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Current workspace + integer credit balance (docs/PRICING.md §5.1)."""
    balance = await get_balance(db, auth.workspace.id)
    return {
        "id": auth.workspace.id,
        "name": auth.workspace.name,
        "plan": _plan_str(auth.workspace.plan),
        "credits_balance_units": balance,
        "created_at": auth.workspace.created_at.isoformat() if auth.workspace.created_at else "",
    }
