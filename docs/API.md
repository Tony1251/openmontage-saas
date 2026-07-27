# OpenMontage SaaS — API Contract

All endpoints under `/v1/*` require `Authorization: Bearer sk_live_xxx` (or `sk_test_xxx`).

## Authentication

API keys are issued via dashboard (or `POST /v1/api-keys`). Format: `sk_(live|test)_<32hex>`.
Server stores only SHA-256 hash of the secret portion. Full key returned **only once** at creation.

## Endpoints

### Renders

#### `POST /v1/renders`
Create a new video render.
```json
// Request
{
  "prompt": "A cinematic drone shot over misty mountains at sunrise",
  "model": "doubao-seedance-2-0-260128",
  "duration_sec": 5,
  "resolution": "720p",
  "metadata": { "reference_image_url": "https://..." }
}
// 200 Response
{ "id": 42, "status": "queued", "created_at": "2026-07-27T08:00:00Z", "estimated_completion_at": "2026-07-27T08:01:30Z" }
// 429 (quota exceeded)
{ "error": "monthly_quota_exceeded", "used": 10, "limit": 10, "upgrade_url": "/dashboard/billing" }
```

#### `GET /v1/renders/{id}`
```json
{ "id": 42, "status": "succeeded", "prompt": "...", "video_url": "https://oss.openmontage.dev/renders/42.mp4?signature=...", "cost_cents": 8, "created_at": "...", "completed_at": "..." }
```

#### `GET /v1/renders?limit=20&status=succeeded`
Paginated list of workspace renders.

### API Keys

#### `POST /v1/api-keys`
```json
{ "label": "production-server" }
// 201
{ "id": 5, "public_key": "sk_live_a1b2c3d4...", "secret": "sk_live_a1b2c3d4e5f6...", "label": "production-server" }
```
⚠️ `secret` only returned here. Never again.

#### `GET /v1/api-keys` — list keys (without secrets)
#### `DELETE /v1/api-keys/{id}` — revoke. Idempotent.

### Billing

#### `POST /v1/billing/checkout`
```json
{ "plan": "pro" }
// 200
{ "url": "https://checkout.stripe.com/..." }
```

#### `POST /v1/billing/portal` — `{ url }` to Stripe Customer Portal

### Webhooks

#### `POST /webhooks/stripe`
Stripe webhook receiver. Handles `customer.subscription.created/updated/deleted`, `invoice.paid/failed`.

#### `POST /webhooks/render-complete`
OpenMontage MCP callback. Body: `{ ark_task_id, status, video_url }`. Looks up render by `ark_task_id`, updates.

### Health

#### `GET /health` (no auth)
```json
{ "status": "ok", "version": "0.1.0", "deps": { "db": "ok", "mcp": "ok" } }
```

## Quota / rate limits

| Plan | Monthly renders | Concurrent | API calls/min |
|---|---|---|---|
| free | 10 | 1 | 60 |
| pro | 200 | 5 | 600 |
| enterprise | unlimited | custom | custom |

## Error format
```json
{ "error": "string_code", "message": "human readable", "details": { ... } }
```
Codes: `unauthorized`, `forbidden`, `not_found`, `monthly_quota_exceeded`, `concurrent_limit_exceeded`, `rate_limited`, `validation_error`, `internal_error`.

## Cross-cutting
- Timestamps ISO 8601 UTC.
- IDs integer (matches Postgres `serial`).
- Money in `cost_cents` integer.
- Idempotency: `POST /v1/renders` accepts optional `Idempotency-Key` header (24h window).
