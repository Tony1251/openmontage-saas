# OpenMontage SaaS
[![CI](https://github.com/yuhengluo/openmontage-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/yuhengluo/openmontage-saas/actions)


Multi-tenant SaaS wrapping the OpenMontage video-generation pipeline (95 tools) behind a pay-per-render HTTP API + Next.js dashboard + Stripe billing.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js 15 Web  │────▶│  FastAPI Gateway │────▶│ OpenMontage MCP  │
│  (apps/web)      │     │  (apps/api)      │     │ (existing)       │
│  - Landing       │     │  - API key auth  │     │ 95 tools         │
│  - Dashboard     │     │  - Quota         │     │                  │
│  - Clerk auth    │     │  - Stripe        │     │                  │
└──────────────────┘     └─────────┬────────┘     └────────┬─────────┘
                                   │                        │
                            ┌──────▼──────┐          ┌─────▼──────┐
                            │ Postgres 16 │          │ ARK Seedance│
                            │ + Drizzle   │          │             │
                            └─────────────┘          └─────────────┘
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui |
| Auth | Clerk (email + OAuth) |
| Backend | FastAPI 0.115 + Pydantic v2 + SQLAlchemy 2.0 async |
| Database | Postgres 16 (Drizzle schema in `packages/db/`) |
| Billing | Stripe (subscriptions + Customer Portal + webhooks) |
| Storage | OSS / S3 (stubbed — see `app/services/storage.py`) |
| Orchestration | Docker Compose |

## Quick start

```bash
# 1. Bring up Postgres
docker compose up -d postgres

# 2. Run migrations
cd apps/api && uv sync && alembic upgrade head

# 3. Start API
uv run uvicorn app.main:app --reload --port 8000

# 4. Start web (in another terminal)
cd apps/web && npm install && npm run dev
```

Visit:
- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Repo layout

```
openmontage-saas/
├── apps/
│   ├── api/                    # FastAPI gateway (28 files, ~1.5K lines)
│   │   ├── app/
│   │   │   ├── main.py         # FastAPI app, CORS, lifespan
│   │   │   ├── config.py       # Pydantic Settings
│   │   │   ├── db.py           # async SQLAlchemy engine
│   │   │   ├── models.py       # 11 SQLAlchemy models
│   │   │   ├── auth.py         # API key validation
│   │   │   ├── routers/        # renders, api_keys, billing, webhooks, users, health
│   │   │   ├── services/       # openmontage (MCP), quota, stripe, storage, audit
│   │   │   └── schemas/        # Pydantic request/response models
│   │   ├── alembic/            # DB migrations (initial migration included)
│   │   └── tests/              # pytest smoke tests
│   └── web/                    # Next.js dashboard (28 files, ~800 lines)
│       ├── app/                # App Router pages
│       ├── components/ui/      # shadcn primitives (button, card, input, ...)
│       └── lib/                # api client, types, utils
├── packages/
│   ├── db/                     # Drizzle schema (authoritative)
│   └── shared/                 # TS types shared between api + web
├── docs/
│   └── API.md                  # Full API contract (endpoints, payloads, errors, quotas)
└── docker-compose.yml          # postgres + api + web
```

## API surface (summary)

See [`docs/API.md`](docs/API.md) for full contract.

| Endpoint | Purpose |
|---|---|
| `POST /v1/renders` | Create video render (idempotent) |
| `GET /v1/renders/{id}` | Get render status + video URL |
| `GET /v1/renders` | List workspace renders |
| `POST /v1/api-keys` | Issue API key (returns secret once) |
| `GET /v1/api-keys` | List keys |
| `DELETE /v1/api-keys/{id}` | Revoke key |
| `POST /v1/billing/checkout` | Stripe checkout session |
| `POST /v1/billing/portal` | Stripe Customer Portal |
| `POST /webhooks/stripe` | Stripe webhook receiver |
| `POST /webhooks/render-complete` | OpenMontage MCP callback |
| `POST /v1/users/sync` | Clerk webhook → provision user + workspace |
| `GET /health` | Health check (no auth) |

## Plans (from `docs/API.md`)

| Plan | Price | Monthly renders | Concurrent |
|---|---|---|---|
| Free | ¥0 | 10 | 1 |
| Pro | ¥99 | 200 | 5 |
| Enterprise | custom | unlimited | custom |

## What works now (this commit)

- ✅ Postgres + Alembic migrations
- ✅ FastAPI gateway: 11 endpoints, auth, quota, Stripe checkout, webhooks
- ✅ Next.js dashboard: Landing, Sign-in/up, Dashboard, Renders, API Keys, Billing
- ✅ Clerk auth (sign-in/sign-up + webhook → API user sync)
- ✅ TanStack Query data fetching with toasts
- ✅ Docker Compose with all services
- ✅ Ruff + pytest config

## What's left (next 1-2 weeks)

- Real OSS / S3 upload in `app/services/storage.py` (currently stubbed)
- Idempotency cache → Redis (currently in-memory dict)
- Admin panel at `/admin` (Clerk role gating)
- Usage analytics dashboard (PostHog)
- Sentry error tracking
- CI: lint + typecheck + test on push
- Deploy: Vercel (web) + Fly.io (api) + Neon (DB)
- First paying user (validation!)
