from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import get_engine

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, object]:
    db_status = "ok"
    try:
        async with get_engine().begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "0.1.0",
        "deps": {"db": db_status},
    }
