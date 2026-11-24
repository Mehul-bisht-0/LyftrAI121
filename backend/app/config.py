from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_HERE = Path(__file__).resolve().parent.parent  # backend/


@dataclass(frozen=True)
class DeploymentSpec:
    key_id: str
    model: str
    routing_group: str
    secret: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # check backend/.env, then project root .env
        env_file=(str(_HERE / ".env"), str(_HERE.parent / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str
    groq_api_key: str
    database_url: str = "sqlite:///./data/app.db"
    allowed_origins: str = "http://localhost:3000"
    enable_failure_simulation: bool = False

    @property
    def deployment_specs(self) -> list[DeploymentSpec]:
        return [
            DeploymentSpec(
                key_id="key_1",
                model="gemini/gemini-3.1-flash-lite",
                routing_group="primary",
                secret=self.gemini_api_key,
            ),
            DeploymentSpec(
                key_id="key_2",
                model="groq/qwen/qwen3.8-27b",
                routing_group="fallback",
                secret=self.groq_api_key,
            ),
        ]

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def db_path(self) -> str:
        url = self.database_url
        if url.startswith("sqlite:////"):
            return "/" + url[len("sqlite:////"):]
        if url.startswith("sqlite:///"):
            return url[len("sqlite:///"):]
        raise ValueError(f"Unsupported DATABASE_URL: {url!r}")
