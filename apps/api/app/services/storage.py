"""Stub for OSS / S3 upload. Returns a fake URL."""

from __future__ import annotations


async def upload_render(render_id: int, mp4_bytes: bytes) -> str:
    # TODO: real OSS / S3 upload via oss2 or boto3
    return f"https://oss.openmontage.dev/renders/{render_id}.mp4?stub=true"
