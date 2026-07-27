#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
LOGS_DIR="/tmp/_om_logs"
PIDS_DIR="/tmp/_om_pids"
mkdir -p "$LOGS_DIR" "$PIDS_DIR"
[ -d "$WEB_DIR/node_modules" ] || (cd "$WEB_DIR" && npm install --no-audit --no-fund)
nohup env \
  NEXT_PUBLIC_API_URL='http://localhost:8000' MOCK_MODE='true' \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_mock' CLERK_SECRET_KEY='sk_test_mock' \
  CLERK_WEBHOOK_SIGNING_SECRET='whsec_mock' \
  sh -c "cd '$WEB_DIR' && npm run dev" > "$LOGS_DIR/web.log" 2>&1 &
echo $! > "$PIDS_DIR/web.pid"
echo "Web started PID=$(cat $PIDS_DIR/web.pid) — log: $LOGS_DIR/web.log"
