"""Application configuration with startup validation.

All configuration comes from the environment (or `.env`). In production the
validator refuses to boot with development defaults, demo seed users, or
missing secrets.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-insecure-secret-change-me"
# Fernet key used only in development/test. Production must set ENCRYPTION_KEY.
_DEV_FERNET = "q0m3fV1hT1pX8gQyHn9yS7c2k5u0w4zR3eD6bJ1aL8M="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore", case_sensitive=False)

    # "demo" = a public showcase instance: seeded sample data and simulated integrations,
    # but with production-grade secrets and secure cookies (see _validate_production).
    environment: Literal["development", "test", "demo", "staging", "production"] = "development"
    debug: bool = False
    demo_mode: bool = True
    app_name: str = "ReviewPilot AI"

    database_url: str = "postgresql+asyncpg://reviewpilot:reviewpilot@localhost:5432/reviewpilot"
    redis_url: str = "redis://localhost:6379/0"
    # Dev convenience: run background jobs in-process when Redis is unreachable.
    inline_jobs_fallback: bool = True

    secret_key: str = _DEV_SECRET
    jwt_secret: str = _DEV_SECRET
    encryption_key: str = _DEV_FERNET
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    refresh_token_ttl_days_short: int = 1  # when "remember me" is unchecked
    cookie_secure: bool = False
    cookie_domain: str | None = None

    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None  # sign-in callback
    google_gbp_redirect_uri: str | None = None  # Business Profile connect callback
    oauth_mock_enabled: bool = False  # local/E2E-only mock Google identity provider

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    ai_monthly_request_limit_default: int = 500

    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_business_account_id: str | None = None
    whatsapp_app_secret: str | None = None
    whatsapp_verify_token: str | None = None
    whatsapp_api_version: str = "v21.0"

    resend_api_key: str | None = None
    resend_webhook_secret: str | None = None
    email_from: str = "ReviewPilot AI <no-reply@reviewpilot.ai>"

    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    default_payment_provider: Literal["razorpay", "stripe", "mock"] = "razorpay"
    trial_days: int = 14
    grace_period_days: int = 7

    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_bucket_name: str | None = None
    aws_region: str = "ap-south-1"
    s3_endpoint_url: str | None = None
    local_storage_dir: str = "storage"
    max_upload_bytes: int = 2 * 1024 * 1024

    super_admin_email: str | None = None
    super_admin_bootstrap_secret: str | None = None

    seed_password_owner: str = Field(default="Owner@12345")
    seed_password_admin: str = Field(default="Admin@12345")
    seed_password_staff: str = Field(default="Staff@12345")
    seed_password_super_admin: str = Field(default="SuperAdmin@12345")

    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    @property
    def is_production(self) -> bool:
        return self.environment in ("production", "staging")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def resend_configured(self) -> bool:
        return bool(self.resend_api_key)

    @property
    def whatsapp_platform_configured(self) -> bool:
        return bool(self.whatsapp_access_token and self.whatsapp_phone_number_id)

    @property
    def stripe_configured(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_webhook_secret)

    @property
    def razorpay_configured(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret and self.razorpay_webhook_secret)

    @property
    def s3_configured(self) -> bool:
        return bool(self.aws_access_key_id and self.aws_secret_access_key and self.aws_bucket_name)

    @property
    def sign_in_redirect_uri(self) -> str:
        return self.google_redirect_uri or f"{self.frontend_url}/api/v1/auth/google/callback"

    @property
    def gbp_redirect_uri(self) -> str:
        return self.google_gbp_redirect_uri or f"{self.frontend_url}/api/v1/integrations/google/callback"

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        # Managed Postgres providers (Render, Railway, Heroku) hand out postgres:// URLs.
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                self.database_url = "postgresql+asyncpg://" + url[len(prefix):]
                break
        return self

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if self.environment == "demo":
            weak = [n.upper() for n in ("secret_key", "jwt_secret") if getattr(self, n) == _DEV_SECRET or len(getattr(self, n)) < 32]
            if self.encryption_key == _DEV_FERNET:
                weak.append("ENCRYPTION_KEY")
            if weak or not self.cookie_secure or self.oauth_mock_enabled:
                raise ValueError(f"Demo deployments need strong secrets ({', '.join(weak) or 'ok'}), COOKIE_SECURE=true and OAUTH_MOCK_ENABLED=false")
            return self
        if not self.is_production:
            return self
        problems: list[str] = []
        for name in ("secret_key", "jwt_secret"):
            value = getattr(self, name)
            if value == _DEV_SECRET or len(value) < 32:
                problems.append(f"{name.upper()} must be a random value of at least 32 characters")
        if self.encryption_key == _DEV_FERNET:
            problems.append("ENCRYPTION_KEY must be set to a unique Fernet key")
        if self.demo_mode:
            problems.append("DEMO_MODE must be false in production")
        if self.oauth_mock_enabled:
            problems.append("OAUTH_MOCK_ENABLED must be false in production")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production")
        if self.inline_jobs_fallback:
            problems.append("INLINE_JOBS_FALLBACK must be false in production (run the ARQ worker)")
        if "localhost" in self.database_url:
            problems.append("DATABASE_URL points to localhost")
        if problems:
            raise ValueError("Invalid production configuration:\n  - " + "\n  - ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
