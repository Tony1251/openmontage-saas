#!/usr/bin/env bash
set -uo pipefail
PIDS_DIR="/tmp/_om_pids"
ok() { printf "  ✔ %s\n" "$*"; }
for name in api web; do
  PID_FILE="$PIDS_DIR/$name.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill "$PID" 2>/dev/null; then
      ok "stopped $name (PID $PID)"
    else
      ok "$name not running (stale pid $PID)"
    fi
    mv "$PID_FILE" "$PID_FILE.killed.$$" 2>/dev/null || true
  fi
done
# Also pkill any leftover uvicorn/next dev from our paths
pkill -f "uvicorn.*app.main" 2>/dev/null && ok "killed leftover uvicorn" || true
pkill -f "next.*dev" 2>/dev/null && ok "killed leftover next dev" || true
exit 0
