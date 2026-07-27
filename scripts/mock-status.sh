#!/usr/bin/env bash
printf "%-10s %-8s %s\n" "SERVICE" "STATUS" "DETAIL"
printf "%-10s %-8s %s\n" "-------" "------" "------"
# Postgres
H=$(docker inspect --format "{{.State.Health.Status}}" openmontage-saas-postgres-1 2>/dev/null || echo "down")
printf "%-10s %-8s %s\n" "postgres" "$H" "127.0.0.1:5432"
# API
if curl -sf -m 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  printf "%-10s %-8s %s\n" "api" "up" "127.0.0.1:8000"
else
  printf "%-10s %-8s %s\n" "api" "down" "127.0.0.1:8000"
fi
# Web
HTTP=$(curl -sf -m 2 -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/ 2>/dev/null || echo "—")
[ "$HTTP" = "200" ] && STATUS="up" || STATUS="down"
printf "%-10s %-8s %s\n" "web" "$STATUS" "127.0.0.1:3001 (HTTP $HTTP)"
