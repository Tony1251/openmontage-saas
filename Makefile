.PHONY: help mock mock-up mock-down mock-status mock-logs mock-restart migrate test clean api web db db-stop api-stop web-stop all-stop all-restart

# ─── Default ──────────────────────────────────────────────────────────────────
help:  ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[1;32m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Variables ─────────────────────────────────────────────────────────────────
ROOT_DIR := $(shell pwd)
API_DIR  := $(ROOT_DIR)/apps/api
WEB_DIR  := $(ROOT_DIR)/apps/web
LOGS_DIR := /tmp/_om_logs
PIDS_DIR := /tmp/_om_pids

# ─── Mock mode (everything in one shot) ────────────────────────────────────────
mock:  ## Start full mock stack: db + migrate + api + web
	@bash scripts/mock-up.sh

mock-down:  ## Stop mock api + web (keeps db running)
	@bash scripts/mock-down.sh

mock-status:  ## Show mock service status
	@bash scripts/mock-status.sh

mock-logs:  ## Tail mock api + web logs (Ctrl-C to exit)
	@tail -f $(LOGS_DIR)/api.log $(LOGS_DIR)/web.log

mock-restart: mock-down mock  ## Restart the whole mock stack

# ─── Individual services ───────────────────────────────────────────────────────
db:  ## Start Postgres container (idempotent)
	docker compose up -d postgres

db-stop:  ## Stop Postgres container
	docker compose stop postgres

migrate:  ## Run alembic upgrade head
	cd $(API_DIR) && DATABASE_URL='postgresql+asyncpg://om:om@127.0.0.1:5432/om_saas' \
	  $(API_DIR)/.venv/bin/alembic upgrade head

api:  ## Start API (assumes db+migrate done)
	@bash scripts/run-api.sh

api-stop:  ## Stop API
	@kill $$(cat $(PIDS_DIR)/api.pid 2>/dev/null) 2>/dev/null || echo "api not running"

web:  ## Start Web (assumes api running)
	@bash scripts/run-web.sh

web-stop:  ## Stop Web
	@kill $$(cat $(PIDS_DIR)/web.pid 2>/dev/null) 2>/dev/null || echo "web not running"

# ─── Tests ────────────────────────────────────────────────────────────────────
test:  ## Run pytest
	cd $(API_DIR) && .venv/bin/pytest -v --tb=short

# ─── Cleanup ───────────────────────────────────────────────────────────────────
clean:  ## Nuke venvs, caches, build artefacts (keeps db running)
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	@rm -rf $(API_DIR)/.venv
	@rm -rf $(WEB_DIR)/.next
	@echo "cleaned (db untouched)"

all-stop: mock-down db-stop  ## Stop everything (db included)
all-restart: all-stop mock  ## Full restart

.DEFAULT_GOAL := help
