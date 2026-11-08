"""File storage: S3-compatible bucket in production, local disk in development.

Uploads are restricted to raster images, size-capped, decoded and re-encoded with
Pillow (strips metadata and neutralises polyglot payloads)."""

from __future__ import annotations

import asyncio
import io
import os
import secrets

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import AppError

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}


async def save_image(upload: UploadFile, folder: str, max_side: int = 1024) -> str:
    if upload.content_type not in ALLOWED_TYPES:
        raise AppError("Upload a PNG, JPEG or WebP image.", code="invalid_file_type")
    raw = await upload.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise AppError(f"Image must be under {settings.max_upload_bytes // (1024 * 1024)} MB.", code="file_too_large")
    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
    except (UnidentifiedImageError, OSError):
        raise AppError("That file isn't a valid image.", code="invalid_image")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    key = f"{folder}/{secrets.token_hex(12)}.png"
    return await put_bytes(key, out.getvalue(), "image/png")


async def put_bytes(key: str, data: bytes, content_type: str) -> str:
    if settings.s3_configured:
        import boto3

        def _upload() -> None:
            client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
                endpoint_url=settings.s3_endpoint_url,
            )
            client.put_object(Bucket=settings.aws_bucket_name, Key=key, Body=data, ContentType=content_type, CacheControl="public, max-age=31536000")

        await asyncio.to_thread(_upload)
        base = settings.s3_endpoint_url or f"https://{settings.aws_bucket_name}.s3.{settings.aws_region}.amazonaws.com"
        if settings.s3_endpoint_url:
            return f"{base.rstrip('/')}/{settings.aws_bucket_name}/{key}"
        return f"{base}/{key}"
    path = os.path.join(settings.local_storage_dir, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return f"/api/v1/files/{key}"


async def read_url(url: str | None) -> bytes | None:
    """Fetch stored bytes for server-side rendering (QR logos)."""
    if not url:
        return None
    if url.startswith("/api/v1/files/"):
        path = os.path.join(settings.local_storage_dir, url.removeprefix("/api/v1/files/"))
        if os.path.isfile(path):
            with open(path, "rb") as f:
                return f.read()
        return None
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            return r.content if r.status_code == 200 else None
    except httpx.HTTPError:
        return None
