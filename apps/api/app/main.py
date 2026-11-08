"""ReviewPilot AI API — FastAPI modular monolith."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import settings
from app.core.errors import install_error_handlers

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("reviewpilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting %s (env=%s, demo_mode=%s)", settings.app_name, settings.environment, settings.demo_mode)
    missing = [
        name
        for name, ok in {
            "Google OAuth": settings.google_configured,
            "OpenAI": settings.openai_configured,
            "Resend": settings.resend_configured,
            "WhatsApp Cloud API": settings.whatsapp_platform_configured,
            "Razorpay": settings.razorpay_configured,
            "Stripe": settings.stripe_configured,
        }.items()
        if not ok
    ]
    if missing:
        log.warning("Integrations without credentials (setup states will be shown): %s", ", ".join(missing))
    yield


app = FastAPI(
    title="ReviewPilot AI API",
    version="1.0.0",
    description="Multi-tenant reputation management API. Authenticate with the session cookies issued by /auth/login "
    "or a Bearer access token. Organization-scoped endpoints require the `X-Organization-Id` header.",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Organization-Id", "Authorization"],
    expose_headers=["Content-Disposition", "X-Request-Id"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/v1/") and "docs" not in request.url.path:
        response.headers.setdefault("Cache-Control", "no-store")
    return response


install_error_handlers(app)
app.include_router(api_router, prefix="/api/v1")

# Local file storage (logos, uploads) when S3 is not configured.
if not settings.s3_configured:
    import os

    os.makedirs(settings.local_storage_dir, exist_ok=True)
    app.mount("/api/v1/files", StaticFiles(directory=settings.local_storage_dir), name="files")


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}
