from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthContext, get_auth
from app.schemas.vision import VisionAnalyzeRequest, VisionAnalyzeResponse
from app.services.ark_vision import ArkVisionClient, get_ark_vision

router = APIRouter(tags=["vision"])


@router.post("/vision/analyze")
async def analyze_vision(
    body: VisionAnalyzeRequest,
    auth: Annotated[AuthContext, Depends(get_auth)],
    vision: Annotated[ArkVisionClient, Depends(get_ark_vision)],
) -> VisionAnalyzeResponse:
    try:
        result = await vision.analyze(
            image_url=body.image_url, prompt=body.prompt, model=body.model
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "vision_unavailable", "message": str(exc)},
        ) from exc
    return VisionAnalyzeResponse(result=result)
