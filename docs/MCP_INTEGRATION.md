# MCP Server Integration

How the OpenMontage SaaS API talks to the OpenMontage MCP server (the real video-generation backend) and how to run a closed-loop end-to-end test without spending money on a real `ark_seedance_video` call.

## 1. Overview

The video engine is **not** in this repo. It lives in a separate server:

| | |
|---|---|
| Repo / path | `openmontage-mcp` (sibling project, Python MCP server) |
| Endpoint | `http://<host>:8765/mcp` (Streamable-HTTP, SSE) |
| Tool surface | 91 tools, grouped by provider (ark / seedance / doubao / mock…) |
| Production renderer | `ark_seedance_video` (paid, slow) |
| Test renderer | `mock_video_submit` (free, instant `succeeded`) |

The SaaS API acts as a thin client: it serializes a `Render` row, calls `tools/call` on the MCP server, and then a background worker (`render_worker.py`) polls `get_video_status` until the task finishes.

```
[ client ] ──POST /v1/renders──▶ [ API ] ──tools/call──▶ [ MCP server ]
                                          │                     │
                                          ▼                     ▼
                                       [ Render row ]     [ ark_task_id ]
                                          ▲                     │
                                          └─── poll loop ───────┘
                                                (every 3s)
```

## 2. Configuration

All knobs are environment variables. The repo ships sane defaults in `docker-compose.yml` (`x-api-env`); local Uvicorn runs must export them yourself.

| Var | Required | Default | Purpose |
|---|---|---|---|
| `MCP_URL` | yes | _none_ | MCP Streamable-HTTP endpoint, e.g. `http://127.0.0.1:8765/mcp`. |
| `MCP_TOKEN` | yes | _none_ | Bearer token from `openmontage-mcp/tokens.json` (first non-`_` key). |
| `MOCK_MODE` | no | `false` | When `true`, the API skips MCP submit **unless** `MCP_E2E=1`. |
| `MCP_E2E` | no | _unset_ | Escape hatch: enable real MCP submission in `MOCK_MODE=true` for E2E. |
| `MCP_RENDER_TOOL` | no | _auto_ | Force a specific tool name. Omit for auto-pick (mock → `mock_video_submit`, else `ark_seedance_video`). |
| `DATABASE_URL` | yes | _none_ | `postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas` for local Docker. |

The token **must** be the real bearer value copied from `openmontage-mcp/tokens.json`. Empty tokens return `401 from MCP server before streaming`.

### Known issue / workaround

The `completed_at` column is `TIMESTAMP WITHOUT TIME ZONE` (Postgres-style), but the worker originally wrote `datetime.now(timezone.utc)` (tz-aware). Postgres then refuses with `can't subtract offset-naive and offset-aware datetimes`. The worker now strips the tzinfo before writing:

```python
render.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
```

If you want truly tz-aware columns instead, change `Render.completed_at` to `DateTime(timezone=True)` and add an Alembic migration doing `ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE USING completed_at AT TIME ZONE 'UTC'`.

## 3. End-to-end test (free, deterministic)

Verifies the full `queued → running → succeeded` transition without paying for `ark_seedance_video`.

### 3.1 Start the MCP server

```bash
cd /Users/yuhengluo/mcp-servers/openmontage-mcp
nohup env -i HOME="$HOME" PATH="$PATH" \
  $(grep -v '^#' .env | xargs) \
  .venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8765 \
  </dev/null >/tmp/mcp.log 2>&1 &
disown
```

### 3.2 Start the SaaS API

```bash
cd /Users/yuhengluo/Documents/openmontage界面设计/openmontage-saas
TOKEN=$(python3 -c "import json; t=json.load(open('/Users/yuhengluo/mcp-servers/openmontage-mcp/tokens.json')); print([k for k in t if not k.startswith('_')][0])")

MOCK_MODE=true MCP_E2E=1 MCP_RENDER_TOOL=mock_video_submit \
DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
MCP_URL='http://127.0.0.1:8765/mcp' \
MCP_TOKEN="$TOKEN" \
nohup apps/api/.venv/bin/uvicorn app.main:app \
  --host 127.0.0.1 --port 8000 --app-dir apps/api \
  </dev/null >/tmp/api.log 2>&1 &
disown
```

### 3.3 Submit a render

```bash
curl -s -X POST http://127.0.0.1:8000/v1/renders \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{"prompt":"heroic dragon","model":"mock-ffmpeg","duration_sec":5,"resolution":"720p"}'
```

### 3.4 Watch the worker advance the row

```bash
docker exec openmontage-saas-postgres-1 \
  psql -U om -d om_saas -c \
  "SELECT id,status,ark_task_id,video_url,completed_at FROM renders ORDER BY id DESC LIMIT 5;"
```

Within ~3s the worker should flip the row to `succeeded` and populate `video_url`. Logs from `apps/api/.venv/bin/uvicorn` show `render N completed: http://...`.

### 3.5 Verify the video is downloadable

```bash
curl -sIL "$(docker exec openmontage-saas-postgres-1 \
  psql -U om -d om_saas -tA -c \
  "SELECT video_url FROM renders WHERE id=<ID>;")" | head -5
```

Should return `HTTP/1.1 200 OK` with a `Content-Type: video/mp4` header.

## 4. Production cutover

Drop the test flags and the API will pick `ark_seedance_video` automatically:

```bash
MOCK_MODE=false \
MCP_URL='https://your-mcp.example.com/mcp' \
MCP_TOKEN='<real token>' \
DATABASE_URL='postgresql+asyncpg://user:pass@host:5432/om_saas' \
  uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The auto-selection logic in `app/services/openmontage.py:submit_video_render`:

```python
if _os.environ.get("MCP_RENDER_TOOL"):
    tool = _os.environ["MCP_RENDER_TOOL"]
elif "mock" in (model or "").lower():
    tool = "mock_video_submit"
else:
    tool = "ark_seedance_video"
```

Per-render `model` field still flows through to the MCP tool call's `arguments.model`, so the MCP server can route different models to different providers.

## 5. Verified E2E run

Recorded on 2026-08-11 against commit `fb2297d` + worker tz fix.

| Step | Evidence |
|---|---|
| API health | `GET /health` → `200 {"status":"ok"}` |
| MCP server | `POST /mcp initialize` → `200`, `mcp-session-id` returned |
| Render created | `POST /v1/renders` → `201`, id=N, status=`running`, `ark_task_id=mock-…` |
| Worker polled | `mock_video_status` returned `succeeded` |
| DB row | `SELECT … FROM renders` → `status=succeeded`, `video_url=http://127.0.0.1:8765/mock-video/mock-….mp4`, `completed_at` populated |
| Video reachable | `curl -I` on `video_url` → `200`, `Content-Type: video/mp4` |
