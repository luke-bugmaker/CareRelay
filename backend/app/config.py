from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./care_relay.db"
    upload_dir: Path = Path("uploads")
    cors_origins: str = "http://localhost:5173"

    # AI provider. Any OpenAI-compatible chat-completions endpoint works
    # (OpenAI, DeepSeek, Qwen/DashScope, Moonshot, OpenRouter, a local server).
    # Leave ai_api_key empty and the app runs on its offline keyword fallback.
    ai_api_key: str | None = None
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 60.0

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.ai_api_key and self.ai_model)


settings = Settings()
