#!/usr/bin/env bash
# Idempotent mock bootstrap: db + migrate + api + web.
# Usage: bash scripts/mock-up.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
LOGS_DIR="/tmp/_om_logs"
PIDS_DIR="/tmp/_om_pids"

mkdir -p "$LOGS_DIR" "$PIDS_DIR"

bold() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✔ %s\033[0m\n" "$*"; }
warn() { printf "  \033[1;33m⚠ %s\033[0m\n" "$*"; }

# Stop any existing instances
bash "$ROOT_DIR/scripts/mock-down.sh" 2>/dev/null || true

bold "1. Postgres"
docker compose up -d postgres
for i in $(seq 1 15); do
  H=$(docker inspect --format "{{.State.Health.Status}}" openmontage-saas-postgres-1 2>/dev/null)
  [ "$H" = "healthy" ] && { ok "healthy"; break; }
  sleep 2
done
[ "$H" = "healthy" ] || { warn "postgres not healthy after 30s — continuing anyway"; }

bold "2. Migrations"
if [ ! -d "$API_DIR/.venv" ]; then
  warn "API venv missing — first-time install (1-2 min)"
  (cd "$API_DIR" && uv venv .venv --clear && uv pip install --quiet -e .)
fi
(cd "$API_DIR" && DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
  "$API_DIR/.venv/bin/alembic" upgrade head) || warn "migration failed (run manually)"

bold "3. API (uvicorn, MOCK_MODE=true)"
nohup env \
  DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
  MCP_URL='http://127.0.0.1:8765/mcp' MCP_TOKEN='' \
  STRIPE_SECRET_KEY='' STRIPE_WEBHOOK_SECRET='' \
  STRIPE_PRICE_PRO='' STRIPE_PRICE_ENTERPRISE='' \
  API_BASE_URL='http://localhost:8000' WEB_BASE_URL='http://localhost:3000' \
  CLERK_WEBHOOK_SECRET='' MOCK_MODE='true' \
  "$API_DIR/.venv/bin/uvicorn" app.main:app \
    --host 127.0.0.1 --port 8000 --log-level info --app-dir "$API_DIR" \
  > "$LOGS_DIR/api.log" 2>&1 &
echo $! > "$PIDS_DIR/api.pid"
sleep 4
ok "API started (PID $(cat $PIDS_DIR/api.pid)) — log: $LOGS_DIR/api.log"

bold "4. Web (Next.js dev, MOCK_MODE=true)"
if [ ! -d "$WEB_DIR/node_modules" ]; then
  warn "Web node_modules missing — first-time install (1-2 min)"
  (cd "$WEB_DIR" && npm install --no-audit --no-fund > "$LOGS_DIR/web-install.log" 2>&1)
fi
nohup env \
  NEXT_PUBLIC_API_URL='http://localhost:8000' \
  MOCK_MODE='true' \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_mock' \
  CLERK_SECRET_KEY='sk_test_mock' \
  CLERK_WEBHOOK_SIGNING_SECRET='whsec_mock' \
  sh -c "cd '$WEB_DIR' && npm run dev" > "$LOGS_DIR/web.log" 2>&1 &
echo $! > "$PIDS_DIR/web.pid"
sleep 6
ok "Web started (PID $(cat $PIDS_DIR/web.pid)) — log: $LOGS_DIR/web.log"

bold "5. Verify"
sleep 3
HEALTH=$(curl -sf -m 5 http://127.0.0.1:8000/health 2>/dev/null && echo OK || echo FAIL)
echo "  API  :8000/health → $HEALTH"
WEB=$(curl -sf -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ 2>/dev/null || echo FAIL)
echo "  Web :3001/ → HTTP $WEB"
[ "$HEALTH" = "OK" ] && [ "$WEB" = "200" ] && ok "all up" || warn "some failed (check logs)"

echo ""
echo "  → API: http://127.0.0.1:8000"
echo "  → API docs: http://127.0.0.1:8000/docs"
echo "  → Web: http://127.0.0.1:3001"
echo ""
echo "  Stop: make mock-down"
echo "  Logs: make mock-logs"
