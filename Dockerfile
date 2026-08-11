# syntax=docker/dockerfile:1.4

# ─────────────────────────────────────────────────────────────────────────────
# OpenMontage SaaS — single multi-target image.
#
#   docker build --build-arg TARGET=api .   # FastAPI (default)
#   docker build --build-arg TARGET=web .   # Next.js standalone
#
# Used by Fly.io (fly.toml / fly.api.toml / fly.web.toml). Docker Compose
# (dev + prod) uses the per-app Dockerfiles in apps/.
# ─────────────────────────────────────────────────────────────────────────────
ARG TARGET=api

# ─── Shared bases ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

FROM node:20-alpine AS node-base
ENV NEXT_TELEMETRY_DISABLED=1

# ─── Target: api (FastAPI) ────────────────────────────────────────────────────
FROM python-base AS api
WORKDIR /app
COPY apps/api/pyproject.toml ./
RUN uv pip install --system --no-cache .
COPY apps/api/ ./
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ─── Target: web (Next.js standalone) ─────────────────────────────────────────
FROM node-base AS web
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.your-domain.com
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_MOCK_MODE=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_MOCK_MODE=$NEXT_PUBLIC_MOCK_MODE

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build

RUN cp -R .next/static .next/standalone/.next/static \
    && if [ -d public ]; then cp -R public .next/standalone/public; fi

ENV NODE_ENV=production \
    PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD wget -q -T 5 -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", ".next/standalone/server.js"]

# ─── Select target ─────────────────────────────────────────────────────────────
FROM ${TARGET}
