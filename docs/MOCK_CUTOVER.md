# MOCK_MODE → Live Cutover

The app runs in two modes, controlled by `MOCK_MODE`:

| Mode | API auth | Stripe | Clerk | MCP |
|------|----------|--------|-------|-----|
| `MOCK_MODE=true` | bypassed (fake workspace) | bypassed | skipped in web | required (or render stays `queued`) |
| `MOCK_MODE=false` | generated `sk_live_`/`sk_test_` API keys | real checkout + webhooks | real sign-in via Clerk | required |

## When to cut over

- Demo is done and you are onboarding real users.
- You want to verify the full SaaS loop (sign-up → API key → render → billing).
- You are deploying behind HTTPS (Clerk and Stripe webhooks require public URLs).

## The 4 secrets you must provide

1. **Clerk** — https://dashboard.clerk.com → *API Keys*
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (web)
   - `CLERK_SECRET_KEY` (web middleware + reserved for API)
   - `CLERK_JWT_KEY` (optional: enable JWT verification on the API)
   - `CLERK_WEBHOOK_SIGNING_SECRET` (web) / `CLERK_WEBHOOK_SECRET` (API) — Svix `whsec_` value from the Clerk webhook endpoint config
2. **Stripe** — https://dashboard.stripe.com/apikeys and *Products/Prices*
   - `STRIPE_SECRET_KEY` (`sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_...` from the webhook endpoint)
   - `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE` (price IDs)
3. **OpenMontage MCP** — the deployed MCP endpoint URL and its auth token (e.g. from `tokens.json`)
   - `MCP_URL` / `MCP_TOKEN`
4. **Postgres** — a managed database URL
   - `DATABASE_URL` (`postgresql+asyncpg://USER:PASS@HOST:5432/om_saas`)

Everything else (Redis, OSS/S3) is optional for the first live deployment.

## Before switching — test these 5 things

1. `curl http://localhost:8000/health` → `{"status":"ok","deps":{"db":"ok"}}`
2. Sign up via Clerk web UI, confirm the user is created in Postgres (`/v1/users/sync` webhook fires)
3. Create an API key in the dashboard, then call `POST /v1/renders` with `Authorization: Bearer sk_test_...`
4. Confirm the render row appears in Postgres (`SELECT * FROM renders ORDER BY id DESC`)
5. Trigger a Stripe checkout and confirm `customer.subscription.created` webhook lands (Stripe CLI: `stripe listen --forward-to localhost:8000/webhooks/stripe`)

## Steps

```bash
cd /Users/yuhengluo/Documents/openmontage界面设计/openmontage-saas

# 1. Backup current mock envs
cp apps/api/.env apps/api/.env.backup
cp apps/web/.env apps/web/.env.backup

# 2. Fill real values (see templates)
cp apps/api/.env.live.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# ...edit both files, set MOCK_MODE=false...

# 3. Restart everything
make all-restart

# 4. Verify
curl http://localhost:8000/health
```

## Rollback

Restore the backups and restart:

```bash
cp apps/api/.env.backup apps/api/.env
cp apps/web/.env.backup apps/web/.env
make all-restart
```

If webhooks misbehave, check `MOCK_MODE` is `false` everywhere and that the webhook
endpoints are configured in Clerk/Stripe with the correct signing secrets.
