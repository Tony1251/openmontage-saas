#!/bin/bash
set -uo pipefail
MCP_DIR=/Users/yuhengluo/mcp-servers/openmontage-mcp
PROJECT_DIR=/Users/yuhengluo/Documents/openmontage界面设计/openmontage-saas
LOG=/Users/yuhengluo/Documents/openmontage界面设计/openmontage-saas/e2e_$(date +%s).log

echo "========== STEP 1: clean up any old processes ==========" >"$LOG"
pkill -f "mcp_server.py" 2>/dev/null || true
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

echo "========== STEP 2: launch MCP server ==========" >>"$LOG"
cd /Users/yuhengluo/openmontage/OpenMontage
nohup env -i \
    HOME="$HOME" \
    PATH="/opt/homebrew/opt/ffmpeg-full/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/yuhengluo/.local/bin" \
    PYTHONNOUSERSITE=1 \
    CONDA_NO_PLUGINS=true \
    OPENMONTAGE_MCP_HTTP=1 \
    OPENMONTAGE_MCP_TOKENS_FILE="$MCP_DIR/tokens.json" \
    /Users/yuhengluo/openmontage/OpenMontage/.venv/bin/python \
    -E "$MCP_DIR/mcp_server.py" --host 127.0.0.1 --port 8765 \
    </dev/null >>/tmp/mcp_run.log 2>&1 &
MCP_PID=$!
disown
echo "MCP_PID=$MCP_PID" >>"$LOG"

# Wait for MCP to be ready
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if curl -fs -X POST http://127.0.0.1:8765/mcp \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
      >/tmp/mcp_init.txt 2>/dev/null; then
    echo "MCP up after ${i}s" >>"$LOG"
    break
  fi
  sleep 1
done

echo "========== STEP 3: launch API ==========" >>"$LOG"
TOKEN=$(python3 -c "import json; t=json.load(open('$MCP_DIR/tokens.json')); print([k for k in t if not k.startswith('_')][0])")
echo "Using MCP_TOKEN prefix=${TOKEN:0:8}..." >>"$LOG"

cd "$PROJECT_DIR"
nohup env -i \
    HOME="$HOME" \
    PATH="/opt/homebrew/opt/ffmpeg-full/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/yuhengluo/.local/bin" \
    PYTHONNOUSERSITE=1 \
    CONDA_NO_PLUGINS=true \
    MOCK_MODE=true \
    MCP_E2E=1 \
    MCP_RENDER_TOOL=mock_video_submit \
    DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
    MCP_URL='http://127.0.0.1:8765/mcp' \
    MCP_TOKEN="$TOKEN" \
    STRIPE_SECRET_KEY=sk_test_mock \
    STRIPE_WEBHOOK_SECRET=whsec_mock \
    STRIPE_PRICE_PRO=price_pro_mock \
    STRIPE_PRICE_ENTERPRISE=price_ent_mock \
    API_BASE_URL=http://127.0.0.1:8000 \
    WEB_BASE_URL=http://127.0.0.1:3000 \
    /Users/yuhengluo/Documents/openmontage界面设计/openmontage-saas/apps/api/.venv/bin/python \
    -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir apps/api \
    </dev/null >>/tmp/api_run.log 2>&1 &
API_PID=$!
disown
echo "API_PID=$API_PID" >>"$LOG"

# Wait for API to be ready
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if curl -fs http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "API up after ${i}s" >>"$LOG"
    break
  fi
  sleep 1
done

echo "========== STEP 4: POST render ==========" >>"$LOG"
RESP=$(curl -s -X POST http://127.0.0.1:8000/v1/renders \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"heroic dragon over mountains","model":"mock-ffmpeg","duration_sec":5,"resolution":"720p"}')
echo "POST response: $RESP" >>"$LOG"
RENDER_ID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "RENDER_ID=$RENDER_ID" >>"$LOG"

if [ -z "$RENDER_ID" ]; then
  echo "POST failed. tail of API log:" >>"$LOG"
  tail -50 /tmp/api_run.log >>"$LOG"
fi

echo "========== STEP 5: wait for worker to advance ==========" >>"$LOG"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 1
  ROW=$(docker exec openmontage-saas-postgres-1 psql -U om -d om_saas -tA \
    -c "SELECT status || '|' || COALESCE(ark_task_id,'') || '|' || COALESCE(video_url,'') || '|' || COALESCE(completed_at::text,'') FROM renders WHERE id=$RENDER_ID;" 2>/dev/null)
  echo "t=${i}s: $ROW" >>"$LOG"
  if [[ "$ROW" == succeeded* ]]; then
    break
  fi
done

echo "========== STEP 6: final DB row ==========" >>"$LOG"
docker exec openmontage-saas-postgres-1 psql -U om -d om_saas \
  -c "SELECT id,status,ark_task_id,video_url,completed_at FROM renders WHERE id=$RENDER_ID;" >>"$LOG" 2>&1

echo "========== STEP 7: get video_url and test ==========" >>"$LOG"
VIDEO_URL=$(docker exec openmontage-saas-postgres-1 psql -U om -d om_saas -tA \
  -c "SELECT video_url FROM renders WHERE id=$RENDER_ID;" 2>/dev/null)
echo "video_url=$VIDEO_URL" >>"$LOG"
if [ -n "$VIDEO_URL" ]; then
  curl -sIL "$VIDEO_URL" | head -10 >>"$LOG"
fi

echo "========== STEP 8: tail api log (last 30) ==========" >>"$LOG"
tail -30 /tmp/api_run.log >>"$LOG"

# Cleanup
echo "========== STEP 9: cleanup ==========" >>"$LOG"
kill -TERM $API_PID 2>/dev/null || true
kill -TERM $MCP_PID 2>/dev/null || true
sleep 1
pkill -f "mcp_server.py" 2>/dev/null || true
pkill -f "uvicorn app.main:app" 2>/dev/null || true
echo "done" >>"$LOG"

echo "============== LOG SUMMARY =============="
cat "$LOG"
