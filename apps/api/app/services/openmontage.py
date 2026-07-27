from __future__ import annotations
import httpx
from app.config import settings


class MCPClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.mcp_url,
            headers={"Authorization": f"Bearer {settings.mcp_token}", "Content-Type": "application/json"},
            timeout=60.0,
        )

    async def call_tool(self, name: str, arguments: dict) -> dict:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
        resp = await self._client.post("", json=payload)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"MCP error: {data['error']}")
        return data.get("result", {})

    async def submit_video_render(self, prompt: str, model: str, duration_sec: int, resolution: str, metadata: dict | None = None) -> str:
        """Returns ark_task_id."""
        args = {"prompt": prompt, "model": model, "duration_sec": duration_sec, "resolution": resolution, "metadata": metadata or {}}
        result = await self.call_tool("ark_seedance_video", args)
        return result.get("ark_task_id") or result.get("task_id") or ""

    async def list_tools(self) -> list[dict]:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
        resp = await self._client.post("", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("result", {}).get("tools", [])

    async def close(self) -> None:
        await self._client.aclose()


_mcp: MCPClient | None = None


def get_mcp() -> MCPClient:
    global _mcp
    if _mcp is None:
        _mcp = MCPClient()
    return _mcp
