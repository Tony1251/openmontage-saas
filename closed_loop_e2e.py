#!/usr/bin/env python3
"""Closed-loop E2E test for openmontage-saas (in-process ASGI + SQLite)."""

import os, sys, json, asyncio

API_DIR = os.path.join(os.path.dirname(__file__), "apps", "api")
sys.path.insert(0, API_DIR)

os.environ.setdefault("MOCK_MODE", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-e2e")
os.environ.setdefault("API_BASE_URL", "http://localhost:8000")
os.environ.setdefault("WEB_BASE_URL", "http://localhost:3000")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_mock")
os.environ.setdefault("STRIPE_PRICE_PRO", "price_pro_mock")
os.environ.setdefault("STRIPE_PRICE_ENTERPRISE", "price_ent_mock")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_mock")
os.environ.setdefault("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_mock")
os.environ.setdefault("MCP_URL", "http://127.0.0.1:8765/mcp")
os.environ.setdefault("MCP_TOKEN", "")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite://"

# Patch create_async_engine to strip PG-only pool params for SQLite
import sqlalchemy.ext.asyncio as sa_asyncio
_orig_create = sa_asyncio.create_async_engine
def _patched(url, **kw):
    if "sqlite" in str(url).lower():
        kw.pop("pool_size", None)
        kw.pop("max_overflow", None)
    return _orig_create(url, **kw)
sa_asyncio.create_async_engine = _patched

from app.config import settings
from app.db import get_db
from app.models import Base
from app.main import app
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient, ASGITransport

results = []
def record(step, name, ok, detail):
    results.append({"step": step, "name": name, "ok": ok, "detail": detail})
    icon = "✅" if ok else "❌"
    print(f"  {icon} STEP {step}: {name} — {detail}")

async def run_e2e():
    print("=" * 60)
    print("openmontage-saas — Closed-loop E2E Test (SQLite in-process)")
    print("=" * 60)

    # Create a local SQLite engine with all tables
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # ── Step 2: Health ──────────────────────────────────────────────────────
        r = await ac.get("/health")
        record(2, "Health check", r.status_code == 200, str(r.json()))

        # ── Step 3: Users/me ────────────────────────────────────────────────────
        r = await ac.get("/v1/users/me", headers={"Authorization": "Bearer sk_test_demo"})
        ok = r.status_code == 200
        detail = f"id={r.json().get('id','?')[:16]}..." if ok else r.text[:100]
        record(3, "Users/me (mock auth)", ok, detail)

        # ── Step 4: Create API key ──────────────────────────────────────────────
        r = await ac.post("/v1/api-keys",
            headers={"Authorization": "Bearer sk_test_demo", "Content-Type": "application/json"},
            json={"label": "e2e closed-loop test"})
        ok = r.status_code == 201
        new_key = r.json().get("full_key", "") if ok else ""
        public_key = r.json().get("public_key", "") if ok else ""
        detail = f"pub={public_key[:16]}... key={new_key[:20]}..." if ok else r.text[:100]
        record(4, "Create API key", ok, detail)

        # ── Step 5: List API keys ───────────────────────────────────────────────
        r = await ac.get("/v1/api-keys", headers={"Authorization": "Bearer sk_test_demo"})
        record(5, "List API keys", r.status_code == 200, f"count={len(r.json())}")

        # ── Step 6: Submit render ───────────────────────────────────────────────
        auth = f"Bearer {new_key}" if new_key else "Bearer sk_test_demo"
        r = await ac.post("/v1/renders",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json={"prompt": "a cinematic sunset over the ocean, drone shot, 4K",
                  "duration_sec": 10, "resolution": "1080p",
                  "model": "doubao-seedance-2-0-260128"})
        ok = r.status_code == 201
        render_id = None
        if ok:
            data = r.json()
            render_id = data.get("id")
            detail = f"id={render_id} status={data.get('status')}"
        else:
            detail = r.text[:150]
        record(6, "Submit render", ok, detail)

        # ── Step 7: Get render ──────────────────────────────────────────────────
        if render_id:
            r = await ac.get(f"/v1/renders/{render_id}", headers={"Authorization": auth})
            ok = r.status_code == 200
            detail = f"status={r.json().get('status')} prompt={r.json().get('prompt','')[:30]}" if ok else r.text[:100]
            record(7, "Get render", ok, detail)
        else:
            record(7, "Get render", False, "No render_id from step 6")

        # ── Step 8: List renders ────────────────────────────────────────────────
        r = await ac.get("/v1/renders?limit=5", headers={"Authorization": auth})
        if r.status_code == 200:
            d = r.json()
            detail = f"count={len(d.get('data',[]))} has_more={d.get('has_more')}"
        else:
            detail = r.text[:100]
        record(8, "List renders", r.status_code == 200, detail)

        # ── Step 9: Billing plan ────────────────────────────────────────────────
        r = await ac.get("/v1/billing/plan", headers={"Authorization": auth})
        if r.status_code == 200:
            d = r.json()
            detail = f"plan={d.get('plan')} used={d.get('renders_used')} quota={d.get('quota')}"
        else:
            detail = r.text[:100]
        record(9, "Billing plan", r.status_code == 200, detail)

        # ── Step 10: Checkout ───────────────────────────────────────────────────
        r = await ac.post("/v1/billing/checkout",
            headers={"Authorization": auth, "Content-Type": "application/json"},
            json={"plan": "pro"})
        ok = r.status_code == 200
        detail = f"url={r.json().get('url','')[:60]}..." if ok else r.text[:100]
        record(10, "Checkout session", ok, detail)

        # ── Step 11: Invoices ───────────────────────────────────────────────────
        r = await ac.get("/v1/billing/invoices", headers={"Authorization": auth})
        record(11, "Invoices", r.status_code == 200, f"count={len(r.json())}")

        # ── Step 12a: Clerk webhook ─────────────────────────────────────────────
        r = await ac.post("/webhooks/clerk",
            headers={"Content-Type": "application/json",
                      "svix-id": "msg_test", "svix-timestamp": "1700000000",
                      "svix-signature": "v1,test"},
            json={"type": "user.created", "data": {"id": "user_test", "email_addresses": [{"email_address": "test@example.com"}]}})
        record(12, "Clerk webhook", r.status_code == 200, str(r.json()))

        # ── Step 12b: Stripe webhook ────────────────────────────────────────────
        r = await ac.post("/webhooks/stripe",
            headers={"Content-Type": "application/json", "stripe-signature": "t=1700000000,v1=test"},
            json={"type": "checkout.session.completed", "data": {"object": {"id": "cs_test"}}})
        record(12, "Stripe webhook", r.status_code == 200, str(r.json()))

        # ── Step 13: DB — render persisted? ─────────────────────────────────────
        r = await ac.get("/v1/renders", headers={"Authorization": auth})
        if r.status_code == 200:
            items = r.json().get("data", [])
            ours = [i for i in items if i.get("id") == render_id]
            record(13, "Render persisted", len(ours) > 0, f"found_in_db={len(ours)} total={len(items)}")

        # ── Step 14: DB — API key persisted? ────────────────────────────────────
        r = await ac.get("/v1/api-keys", headers={"Authorization": "Bearer sk_test_demo"})
        if r.status_code == 200:
            keys = r.json()
            ours = [k for k in keys if k.get("label") == "e2e closed-loop test"]
            record(14, "API key persisted", len(ours) > 0, f"found_in_db={len(ours)} total={len(keys)}")

    # ── Summary ────────────────────────────────────────────────────────────────
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print()
    print("=" * 60)
    print(f"  RESULTS: {passed}/{len(results)} passed, {failed} failed")
    print("=" * 60)
    print()
    print("| # | Step | Status | Detail |")
    print("|---|------|--------|--------|")
    for r in results:
        icon = "✅" if r["ok"] else "❌"
        print(f"| {r['step']:2d} | {r['name']:30s} | {icon} | {r['detail']} |")
    print()
    print(f"  Render ID: {render_id}")
    if public_key:
        print(f"  API Key (pub): {public_key[:16]}...")
    if new_key:
        print(f"  API Key (full): {new_key[:20]}...")
    print()
    return passed == len(results)

if __name__ == "__main__":
    success = asyncio.run(run_e2e())
    sys.exit(0 if success else 1)
