from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import get_engine
from app.routers import api_keys, billing, health, renders, users, vision, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.exec_driver_sql("SELECT 1")
    yield
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
app.include_router(vision.router, prefix="/v1", tags=["vision"])
