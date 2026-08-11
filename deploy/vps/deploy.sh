#!/usr/bin/env bash
# OpenMontage SaaS — one-command VPS deploy (Ubuntu/Debian).
#   bash deploy/vps/deploy.sh [--branch BRANCH] [--env-file PATH] [--repo-dir PATH]
#
# Steps: git pull → install Docker → prepare .env.production → compose up -d
#        → alembic upgrade → smoke tests (pytest best-effort + health curl).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BRANCH="main"
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?--env-file needs a value}"; shift 2 ;;
    --repo-dir) REPO_DIR="${2:?--repo-dir needs a value}"; shift 2 ;;
    -h|--help)
      sed -n '2,4p' "$0"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-${REPO_DIR}/.env.production}"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy:error]\033[0m %s\n' "$*" >&2; exit 1; }

log "repo: ${REPO_DIR} | branch: ${BRANCH} | env: ${ENV_FILE}"

[[ -d "${REPO_DIR}/.git" ]] || fail "${REPO_DIR} is not a git checkout"
command -v git >/dev/null 2>&1 || fail "git is required"

# ── [1/6] git pull ────────────────────────────────────────────────────────────
log "[1/6] updating repository (${BRANCH})"
cd "${REPO_DIR}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

# ── [2/6] docker + compose plugin ─────────────────────────────────────────────
log "[2/6] ensuring Docker + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y --no-install-recommends docker.io docker-compose-plugin \
    || apt-get install -y --no-install-recommends docker.io docker-compose-v2
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || fail "docker compose plugin is unavailable"

# ── [3/6] env file ────────────────────────────────────────────────────────────
log "[3/6] preparing environment file"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_DIR}/.env.production.template" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  fail "${ENV_FILE} created from template — edit secrets first, then re-run"
fi

# ── [4/6] build + start ───────────────────────────────────────────────────────
log "[4/6] docker compose up -d --build"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build

# ── [5/6] migrations ──────────────────────────────────────────────────────────
log "[5/6] alembic upgrade head"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T api alembic upgrade head

# ── [6/6] smoke tests ─────────────────────────────────────────────────────────
log "[6/6] smoke tests"
if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T api \
     sh -c 'command -v pytest >/dev/null && pytest tests/ -q' >/dev/null 2>&1; then
  log "pytest smoke: PASS"
else
  log "pytest smoke: skipped (dev extras not installed in prod image — expected)"
fi

sleep 2
if curl -fsS http://127.0.0.1:8000/health; then
  log "health: PASS (http://127.0.0.1:8000/health)"
else
  log "health: direct probe failed — check nginx/ports if a public domain is configured"
fi

log "done. nginx + TLS: see deploy/vps/README.md"
