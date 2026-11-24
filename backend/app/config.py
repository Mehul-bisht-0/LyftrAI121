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

    # LLM_API_KEYS: comma-separated key pool (key_1, key_2, ...) per assignment spec.
    # When set it takes precedence over the individual key variables below.
    llm_api_keys: str = ""

    # Individual key variables — used when LLM_API_KEYS is not set
    gemini_api_key: str = ""
    groq_api_key: str = ""

    database_url: str = "sqlite:///./data/app.db"
    allowed_origins: str = "http://localhost:3000"
    enable_failure_simulation: bool = False

    # Security
    enable_rate_limiting: bool = True
    chat_rate_limit: str = "10/minute"
    max_tokens_per_response: int = 512
    enable_injection_detection: bool = True

    def _resolved_keys(self) -> tuple[str, str]:
        """Return (gemini_key, groq_key) from LLM_API_KEYS or individual vars."""
        if self.llm_api_keys:
            parts = [k.strip() for k in self.llm_api_keys.split(",") if k.strip()]
            if len(parts) < 2:
                raise ValueError("LLM_API_KEYS must contain at least 2 comma-separated keys")
            return parts[0], parts[1]
        if not self.gemini_api_key or not self.groq_api_key:
            raise ValueError(
                "Set LLM_API_KEYS=key1,key2  or  GEMINI_API_KEY + GROQ_API_KEY"
            )
        return self.gemini_api_key, self.groq_api_key

    @property
    def deployment_specs(self) -> list[DeploymentSpec]:
        gemini_key, groq_key = self._resolved_keys()
        return [
            DeploymentSpec(
                key_id="key_1",
                model="gemini/gemini-3.1-flash-lite",
                routing_group="primary",
                secret=gemini_key,
            ),
            DeploymentSpec(
                key_id="key_2",
                model="groq/qwen/qwen3.8-27b",
                routing_group="fallback",
                secret=groq_key,
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
