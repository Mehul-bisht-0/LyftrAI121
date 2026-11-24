from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ResolutionSource(str, Enum):
    LIVE_INFERENCE = "LIVE_INFERENCE"
    LLM_CACHE = "LLM_CACHE"


class ReplyMetadata(BaseModel):
    resolution_source: ResolutionSource
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str]
    fallback_attempts: int


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str
    system_prompt: Optional[str] = None

    @field_validator("session_id")
    @classmethod
    def session_id_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("session_id must not be blank or whitespace-only")
        return v

    @field_validator("message", mode="before")
    @classmethod
    def strip_and_validate_message(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("message must be a string")
        v = v.strip()
        if not v:
            raise ValueError("message must not be empty after trimming")
        if len(v) > 4000:
            raise ValueError("message must be at most 4000 characters after trimming")
        return v


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    metadata: ReplyMetadata


class HealthResponse(BaseModel):
    status: str
    keys_configured: int
    cache_enabled: bool


class HistoryMessage(BaseModel):
    role: str
    content: str
    metadata: Optional[ReplyMetadata] = None


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]
