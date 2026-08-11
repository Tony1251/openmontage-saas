# Deploy 全家桶

| 方式 | 入口 | 适合 |
|---|---|---|
| VPS | `deploy/vps/deploy.sh` + `docker-compose.prod.yml` | 自有 Linux 服务器，Postgres 同机 |
| Vercel | `apps/web/vercel.json` + `apps/web/README.deploy.md` | 只托管前端，API 外部部署 |
| Fly.io | `fly.toml` / `fly.api.toml` / `fly.web.toml` + 根 `Dockerfile` | 全栈边缘部署，自带 Postgres |

所有方式都共用 `.env.production.template` 作为密钥清单（复制为
`.env.production` 后填写）。CI 流水线在 `.github/workflows/deploy.yml`，push
到 `main` 时自动跑 lint + typecheck + pytest，并可按 secrets 配置部署到
Fly/Vercel。
