#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
LOGS_DIR="/tmp/_om_logs"
PIDS_DIR="/tmp/_om_pids"
mkdir -p "$LOGS_DIR" "$PIDS_DIR"
[ -d "$API_DIR/.venv" ] || (cd "$API_DIR" && uv venv .venv --clear && uv pip install -e .)
nohup env \
  DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
  MCP_URL='http://127.0.0.1:8765/mcp' MCP_TOKEN='' \
  STRIPE_SECRET_KEY='' STRIPE_WEBHOOK_SECRET='' \
  STRIPE_PRICE_PRO='' STRIPE_PRICE_ENTERPRISE='' \
  API_BASE_URL='http://localhost:8000' WEB_BASE_URL='http://localhost:3000' \
  CLERK_WEBHOOK_SECRET='' MOCK_MODE='true' \
  "$API_DIR/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 \
  > "$LOGS_DIR/api.log" 2>&1 &
echo $! > "$PIDS_DIR/api.pid"
echo "API started PID=$(cat $PIDS_DIR/api.pid) — log: $LOGS_DIR/api.log"
