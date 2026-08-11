from __future__ import annotations
import os, sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import engine
from app.routers import renders, api_keys, billing, webhooks, health, users
from app.services.render_worker import run_worker


_worker_task: asyncio.Task | None = None
_worker_stop = asyncio.Event()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task, _worker_stop
    async with engine.begin() as conn:
        await conn.exec_driver_sql("SELECT 1")
    if os.environ.get("MOCK_MODE") == "true":
        _worker_stop = asyncio.Event()
        _worker_task = asyncio.create_task(run_worker(_worker_stop))
        print("[openmontage-saas] render worker started (mock)", file=sys.stderr)
    yield
    if _worker_task is not None:
        _worker_stop.set()
        _worker_task.cancel()
        try:
            await _worker_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
    await engine.dispose()


app = FastAPI(
    title="openmontage-saas API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

if os.environ.get("MOCK_MODE") == "true":
    print("[openmontage-saas] ⚠ MOCK_MODE=true — auth + Stripe bypassed for local dev", file=sys.stderr)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_base_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(renders.router, prefix="/v1", tags=["renders"])
app.include_router(api_keys.router, prefix="/v1", tags=["api-keys"])
app.include_router(billing.router, prefix="/v1", tags=["billing"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(users.router, prefix="/v1", tags=["users"])
