from __future__ import annotations

import json
import re
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app import storage
from app.contracts import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    HistoryMessage,
    HistoryResponse,
)
from app.llm.attempts import parse_simulation
from app.llm.routing import AllProvidersUnavailableError
from app.security import detect_injection, sanitize_input

router = APIRouter()


# ---------------------------------------------------------------------------
# Rate limiting via FastAPI Depends (avoids slowapi decorator signature issues)
# ---------------------------------------------------------------------------

def _parse_rate(limit_str: str) -> tuple[int, float]:
    """Parse '10/minute' -> (10, 60.0). Falls back to 10/min on bad input."""
    m = re.match(r"(\d+)/(second|minute|hour)", limit_str)
    if not m:
        return 10, 60.0
    count = int(m.group(1))
    window = {"second": 1.0, "minute": 60.0, "hour": 3600.0}[m.group(2)]
    return count, window


async def _check_rate_limit(request: Request) -> None:
    settings = request.app.state.settings
    if not settings.enable_rate_limiting:
        return

    max_calls, window = _parse_rate(settings.chat_rate_limit)

    # Per-app bucket store so test instances don't share state
    if not hasattr(request.app.state, "_rate_buckets"):
        request.app.state._rate_buckets = defaultdict(deque)

    forwarded = request.headers.get("X-Forwarded-For", "")
    client_key = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "unknown")
    )

    now = time.monotonic()
    bucket: deque = request.app.state._rate_buckets[client_key]
    while bucket and bucket[0] < now - window:
        bucket.popleft()

    if len(bucket) >= max_calls:
        raise HTTPException(
            status_code=429,
            detail="Too many requests — please slow down.",
            headers={"Retry-After": "60"},
        )
    bucket.append(now)


_RateLimit = Depends(_check_rate_limit)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    db_ready = await storage.check_ready(settings.db_path)
    if not db_ready:
        raise HTTPException(status_code=503, detail="database not ready")
    return HealthResponse(
        status="ok",
        keys_configured=len(settings.deployment_specs),
        cache_enabled=True,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    x_simulate_failure: Optional[str] = Header(
        default=None, alias="X-Simulate-Failure"
    ),
    _rate: None = _RateLimit,
) -> ChatResponse | JSONResponse:
    started_at = time.monotonic()
    settings = request.app.state.settings
    service = request.app.state.chat_service

    # --- Input sanitization ---
    sanitized_message = sanitize_input(body.message)
    sanitized_prompt = sanitize_input(body.system_prompt) if body.system_prompt else None

    # --- Prompt-injection detection ---
    if settings.enable_injection_detection:
        if detect_injection(sanitized_message) or (
            sanitized_prompt and detect_injection(sanitized_prompt)
        ):
            return JSONResponse(
                status_code=400,
                content={"detail": "Message rejected: potentially unsafe content detected."},
            )

    # Rebuild request with sanitized values
    body = body.model_copy(update={
        "message": sanitized_message,
        "system_prompt": sanitized_prompt,
    })

    # --- Failure simulation parsing ---
    sim = None
    if x_simulate_failure is not None and settings.enable_failure_simulation:
        try:
            valid_ids = {spec.key_id for spec in settings.deployment_specs}
            sim = parse_simulation(x_simulate_failure, valid_ids)
        except ValueError as exc:
            return JSONResponse(status_code=422, content={"detail": str(exc)})

    try:
        return await service.send(body, sim, started_at)
    except AllProvidersUnavailableError:
        return JSONResponse(
            status_code=503,
            content={"detail": "all providers unavailable"},
        )
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"detail": "internal server error"},
        )


_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    request: Request,
    _rate: None = _RateLimit,
):
    started_at = time.monotonic()
    settings = request.app.state.settings
    service = request.app.state.chat_service

    sanitized_message = sanitize_input(body.message)
    sanitized_prompt = sanitize_input(body.system_prompt) if body.system_prompt else None

    if settings.enable_injection_detection:
        if detect_injection(sanitized_message) or (
            sanitized_prompt and detect_injection(sanitized_prompt)
        ):
            return JSONResponse(
                status_code=400,
                content={"detail": "Message rejected: potentially unsafe content detected."},
            )

    body = body.model_copy(update={
        "message": sanitized_message,
        "system_prompt": sanitized_prompt,
    })

    async def event_stream():
        async for event in service.stream_send(body, started_at):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.get(
    "/sessions/{session_id}/messages",
    response_model=HistoryResponse,
    response_model_exclude_none=True,
)
async def get_messages(
    session_id: str, request: Request
) -> HistoryResponse:
    settings = request.app.state.settings
    history = await storage.read_history(settings.db_path, session_id)
    if history is None:
        raise HTTPException(status_code=404, detail="session not found")

    messages: list[HistoryMessage] = []
    for item in history:
        msg_data: dict = {"role": item["role"], "content": item["content"]}
        if item.get("metadata"):
            msg_data["metadata"] = item["metadata"]
        messages.append(HistoryMessage(**msg_data))

    return HistoryResponse(session_id=session_id, messages=messages)
