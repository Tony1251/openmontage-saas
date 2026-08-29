from __future__ import annotations

import httpx

from app.config import settings


class ArkVisionClient:
    """OpenAI-compatible client for Volcano Engine Ark multimodal vision models.

    Talks to `POST {ark_base_url}/chat/completions` with an OpenAI-style
    `image_url` content part. Separate from MCPClient (which drives the
    Seedance *video-generation* tool over JSON-RPC).
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {settings.ark_api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )

    async def analyze(self, image_url: str, prompt: str, model: str | None = None) -> str:
        if not settings.ark_api_key:
            raise RuntimeError(
                "ARK_API_KEY not configured — set ARK_API_KEY "
                "(and optionally ARK_BASE_URL / ARK_VISION_MODEL)"
            )
        model = model or settings.ark_vision_model
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
        }
        url = f"{settings.ark_base_url.rstrip('/')}/chat/completions"
        resp = await self._client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"ARK vision unexpected response: {data}") from exc

    async def close(self) -> None:
        await self._client.aclose()


_vision: ArkVisionClient | None = None


def get_ark_vision() -> ArkVisionClient:
    global _vision
    if _vision is None:
        _vision = ArkVisionClient()
    return _vision
