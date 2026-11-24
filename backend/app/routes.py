from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

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

router = APIRouter()


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
) -> ChatResponse | JSONResponse:
    started_at = time.monotonic()
    settings = request.app.state.settings
    service = request.app.state.chat_service

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


@router.get("/sessions/{session_id}/messages", response_model=HistoryResponse, response_model_exclude_none=True)
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
