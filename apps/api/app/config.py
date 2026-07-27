from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    mcp_url: str
    mcp_token: str
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_price_pro: str
    stripe_price_enterprise: str
    api_base_url: str
    web_base_url: str
    oss_endpoint: str = ""
    oss_bucket: str = ""
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    clerk_webhook_secret: str = ""
    redis_url: str = ""


settings = Settings()
