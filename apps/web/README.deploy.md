# Vercel 部署（仅前端）

## 前置条件

- API 已部署在 `https://api.your-domain.com`（VPS / Fly.io 均可）。
- Clerk 应用已创建，拿到 `publishable key` 与 `secret key`。

## 步骤

1. 在 Vercel 导入本仓库，Root Directory 选 `apps/web`，Framework 自动识别
   Next.js（`vercel.json` 已固化构建/安装命令）。
2. 在 Project → Settings → Environment Variables 配置：

| 变量 | 示例 |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.your-domain.com` |
| `NEXT_PUBLIC_MOCK_MODE` | `false` |
| `MOCK_MODE` | `false` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_...` |

   `vercel.json` 会把 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 绑定到 Vercel
   密钥 `@clerk-publishable-key`（在 Settings → Environment Variables 添加）。
3. 绑定域名（如 `your-domain.com`），把 `NEXT_PUBLIC_API_URL` 改为生产地址后
   重新部署。
4. 在 Clerk Dashboard 的 Webhooks 里添加 `https://your-domain.com/api/webhooks/clerk`
   （签名密钥填 `CLERK_WEBHOOK_SIGNING_SECRET`）。

## 注意事项

- `NEXT_PUBLIC_*` 在构建期内联，改它们必须触发重新构建（每次 push 都会）。
- 本目录的 `.env.local` 仅供本地 mock，Vercel 环境变量会覆盖它。
- API 的 `WEB_BASE_URL` 必须填 Vercel 域名，否则 CORS 会拦截浏览器请求。
