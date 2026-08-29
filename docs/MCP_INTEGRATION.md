# MCP / ARK Seedance 接入契约

> 目标：把 `apps/api/app/services/openmontage.py` 从 stub 升级为真实可调用的 MCP 客户端，
> 打通「POST /v1/renders → ARK Seedance 视频生成 → webhook 回写」全链路。

## 现状

- `MCPClient` 类已实现 JSON-RPC 2.0 over HTTP 的骨架（`call_tool`、`submit_video_render`、`list_tools`）。
- 通过 env `MCP_URL` + `MCP_TOKEN` 配置目标 MCP 服务。
- 路由层调用 `submit_video_render` 已修复（commit `5ae2ffe`），参数名为 `extra_metadata`。
- `/webhooks/render-complete` 已实现：接收 `{ark_task_id, status, video_url, error?}`，更新 render 状态。

## 需要的真实信息（本地 Hermes 排查）

OpenMontage 核心管线在哪台机器/哪个端口跑？它是不是真的暴露 MCP(JSON-RPC over HTTP)接口？

**排查动作：**
```bash
# 在你本地执行，告诉我结果
curl -s http://localhost:8765/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -100
```

可能的结果：

| 情况 | 下一步 |
|---|---|
| ✅ 返回 `{"result":{"tools":[...]}}` | 直接用现有 MCPClient，只需配 `MCP_URL` |
| ❌ 端口不通 | OpenMontage 核心还没起服务，或不是 HTTP 接口——需要先看它的代码 |
| ❌ 返回非 JSON-RPC | 接口形态不同，契约要调整 |

## 契约约定（要改的话在 PR 里改）

### `submit_video_render` 的请求/响应

发送给 MCP：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "ark_seedance_video",
    "arguments": {
      "prompt": "string (1-2000 chars)",
      "model": "doubao-seedance-2-0-260128",
      "duration_sec": 5 | 10,
      "resolution": "480p" | "720p" | "1080p",
      "metadata": { "webhook_url": "https://<api>/webhooks/render-complete", "render_id": <int>, ... }
    }
  }
}
```

期望返回（任一字段能拿到任务 ID 即可）：
```json
{ "result": { "ark_task_id": "task_xxx" } }
// 或
{ "result": { "task_id": "task_xxx" } }
```

### Webhook 回调

OpenMontage 完成渲染后调用 `POST {API_BASE_URL}/webhooks/render-complete`：
```json
{ "ark_task_id": "task_xxx", "status": "succeeded" | "failed", "video_url": "https://...", "error": "..." }
```

`metadata.webhook_url` 和 `metadata.render_id` 是我们这边塞进去的，
OpenMontage 管线需要用它们回传。**如果 OpenMontage 不支持 webhook 回调**，
降级方案：在 API 里起后台轮询任务（每 30s 查一次任务状态）。

## 验收标准

- [ ] `MCP_URL`/`MCP_TOKEN` 指向真实 OpenMontage，能列出工具
- [ ] 本地 `make mock` 起服务后，`curl -X POST localhost:8000/v1/renders -d '{...}'` 能拿到真实 `ark_task_id`
- [ ] 等 ARK Seedance 跑完，`GET /v1/renders/{id}` 返回 `status: "succeeded"` 和真实 `video_url`
- [ ] 新增测试：`tests/test_mcp_integration.py`（可用 httpx-mock 模拟 MCP 服务，不打真 API）
- [ ] README 更新「Quick start」段落，说明如何指向真实 MCP

## 不允许做的事

- ❌ 不要把 `MOCK_MODE` 改成默认 false（保留本地开发的逃生门）
- ❌ 不要在测试里打真实 ARK API（费钱+慢，用 httpx-mock）
- ❌ 不要改 `docs/API.md` 的对外契约（要改先发 PR 讨论）
