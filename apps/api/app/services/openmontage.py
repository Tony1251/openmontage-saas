from __future__ import annotations
import json
import httpx
from app.config import settings


def _parse_sse(text: str) -> list[dict]:
    """Parse MCP Streamable-HTTP SSE frames (event: message / data: {...})."""
    msgs: list[dict] = []
    for block in text.split("\n\n"):
        data_lines = [l[6:] for l in block.splitlines() if l.startswith("data:")]
        if data_lines:
            try:
                msgs.append(json.loads("\n".join(data_lines)))
            except json.JSONDecodeError:
                continue
    return msgs


class MCPClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.mcp_url,
            headers={"Authorization": f"Bearer {settings.mcp_token}", "Content-Type": "application/json"},
            timeout=180.0,
            follow_redirects=False,
        )
        self._session_id: str | None = None

    def _url(self) -> str:
        """MCP endpoint without trailing slash (server 307-redirects '/mcp/' -> '/mcp')."""
        return settings.mcp_url.rstrip("/")

    async def _ensure_session(self) -> None:
        """Initialize the MCP streamable-HTTP session (idempotent)."""
        if self._session_id:
            return
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "openmontage-saas", "version": "0.1.0"},
            },
        }
        resp = await self._client.post(
            self._url(),
            json=payload,
            headers={"Accept": "application/json, text/event-stream"},
        )
        resp.raise_for_status()
        self._session_id = resp.headers.get("mcp-session-id")
        if not self._session_id:
            raise RuntimeError("MCP initialize response missing mcp-session-id")
        await self._client.post(
            self._url(),
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            headers={"mcp-session-id": self._session_id, "Accept": "application/json, text/event-stream"},
        )

    async def _rpc(self, payload: dict) -> dict:
        await self._ensure_session()
        resp = await self._client.post(
            self._url(),
            json=payload,
            headers={"mcp-session-id": self._session_id, "Accept": "application/json, text/event-stream"},
        )
        resp.raise_for_status()
        body = resp.text
        msgs = _parse_sse(body) if "event:" in body else [json.loads(body)]
        for msg in msgs:
            if msg.get("id") == payload.get("id"):
                if "error" in msg:
                    raise RuntimeError(f"MCP error: {msg['error']}")
                return msg.get("result", {})
        raise RuntimeError(f"MCP: no response for id={payload.get('id')} (body={body[:200]})")

    async def call_tool(self, name: str, arguments: dict) -> dict:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
        return await self._rpc(payload)

    async def submit_video_render(
        self, prompt: str, model: str, duration_sec: int, resolution: str, metadata: dict | None = None
    ) -> dict:
        """Submit a video render to MCP. Returns {"task_id": str, "status": str, "video_url": str|None}."""
        # Resolve which MCP tool to call. Allows free mock_video_submit for E2E
        # tests while production uses ark_seedance_video.
        import os as _os
        if _os.environ.get("MCP_RENDER_TOOL"):
            tool = _os.environ["MCP_RENDER_TOOL"]
        elif "mock" in (model or "").lower():
            tool = "mock_video_submit"
        else:
            tool = "ark_seedance_video"
        args = {"prompt": prompt, "model": model, "duration_sec": duration_sec,
                "resolution": resolution, "metadata": metadata or {}}
        result = await self.call_tool(tool, args)
        content = result.get("content", [])
        text = content[0].get("text", "{}") if content else "{}"
        try:
            tool_result = json.loads(text)
        except json.JSONDecodeError:
            tool_result = {}
        task_id = (
            tool_result.get("data", {}).get("ark_task_id")
            or tool_result.get("data", {}).get("task_id")
            or tool_result.get("data", {}).get("id")
            or ""
        )
        return {
            "task_id": task_id,
            "status": tool_result.get("data", {}).get("status", ""),
            "video_url": tool_result.get("data", {}).get("video_url"),
            "success": bool(tool_result.get("success", False)),
            "error": tool_result.get("error", ""),
        }

    async def get_video_status(self, task_id: str) -> dict:
        result = await self.call_tool("mock_video_status", {"task_id": task_id})
        content = result.get("content", [])
        text = content[0].get("text", "{}") if content else "{}"
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"success": False, "error": text[:200]}

    async def list_tools(self) -> list[dict]:
        result = await self._rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
        return result.get("tools", [])

    async def close(self) -> None:
        await self._client.aclose()


_mcp: MCPClient | None = None


def get_mcp() -> MCPClient:
    global _mcp
    if _mcp is None:
        _mcp = MCPClient()
    return _mcp
