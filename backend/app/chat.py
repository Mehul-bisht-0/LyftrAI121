from __future__ import annotations

import time
from typing import AsyncGenerator, Optional

from app import sessions, storage
from app.config import Settings
from app.contracts import ChatRequest, ChatResponse, ReplyMetadata, ResolutionSource
from app.guardrails import build_system_prompt, safe_response
from app.llm import cache as llm_cache
from app.llm import routing as llm_routing
from app.llm.attempts import SimulationPlan
from app.llm.cache import CachedAnswer
from app.llm.routing import AllProvidersUnavailableError, ResolvedAnswer


def build_messages(
    user_supplement: str | None,
    history: list[dict],
    new_message: str,
) -> list[dict]:
    """
    Always prepend the Relay AI guardrail system prompt. The user-supplied
    system_prompt (if any) is merged in as supplemental context — it cannot
    replace or override the core identity and policy instructions.
    """
    messages: list[dict] = [
        {"role": "system", "content": build_system_prompt(user_supplement)}
    ]
    messages.extend(history)
    messages.append({"role": "user", "content": new_message})
    return messages


class ChatService:
    def __init__(self, settings: Settings, router, cache) -> None:
        self.settings = settings
        self.router = router
        self.cache = cache

    async def send(
        self,
        req: ChatRequest,
        sim: Optional[SimulationPlan],
        started_at: float,
    ) -> ChatResponse:
        specs = self.settings.deployment_specs
        primary_model = specs[0].model

        async with sessions.hold(req.session_id):
            history, stored_prompt = await storage.read_context(
                self.settings.db_path, req.session_id
            )
            effective_prompt = (
                req.system_prompt if req.system_prompt is not None else stored_prompt
            )
            messages = build_messages(effective_prompt, history, req.message)

            answer: ResolvedAnswer

            if sim is None:
                cached = await llm_cache.find_answer(self.cache, primary_model, messages)
                if cached is not None:
                    answer = ResolvedAnswer(
                        content=safe_response(cached.content),
                        model=cached.model,
                        key_id=None,
                        input_tokens=cached.input_tokens,
                        output_tokens=cached.output_tokens,
                        cache_hit=True,
                        fallback_attempts=0,
                    )
                else:
                    answer = await llm_routing.complete(
                        self.router, specs, messages, sim=None
                    )
                    # Filter output before caching — never store a jailbreak-compliant reply
                    safe_content = safe_response(answer.content)
                    answer = ResolvedAnswer(
                        content=safe_content,
                        model=answer.model,
                        key_id=answer.key_id,
                        input_tokens=answer.input_tokens,
                        output_tokens=answer.output_tokens,
                        cache_hit=answer.cache_hit,
                        fallback_attempts=answer.fallback_attempts,
                    )
                    await llm_cache.store_answer(
                        self.cache,
                        answer.model,
                        messages,
                        CachedAnswer(
                            content=answer.content,
                            model=answer.model,
                            input_tokens=answer.input_tokens,
                            output_tokens=answer.output_tokens,
                        ),
                    )
            else:
                raw = await llm_routing.complete(
                    self.router, specs, messages, sim=sim
                )
                answer = ResolvedAnswer(
                    content=safe_response(raw.content),
                    model=raw.model,
                    key_id=raw.key_id,
                    input_tokens=raw.input_tokens,
                    output_tokens=raw.output_tokens,
                    cache_hit=raw.cache_hit,
                    fallback_attempts=raw.fallback_attempts,
                )

            latency_ms = int((time.monotonic() - started_at) * 1000)
            metadata_dict = {
                "resolution_source": (
                    ResolutionSource.LLM_CACHE.value
                    if answer.cache_hit
                    else ResolutionSource.LIVE_INFERENCE.value
                ),
                "model": answer.model,
                "latency_ms": latency_ms,
                "input_tokens": answer.input_tokens,
                "output_tokens": answer.output_tokens,
                "key_id": answer.key_id,
                "fallback_attempts": answer.fallback_attempts,
            }
            await storage.commit_turn(
                self.settings.db_path,
                req.session_id,
                effective_prompt,
                req.message,
                answer.content,
                metadata_dict,
            )

        return ChatResponse(
            session_id=req.session_id,
            reply=answer.content,
            metadata=ReplyMetadata(**metadata_dict),
        )

    async def stream_send(
        self,
        req: ChatRequest,
        started_at: float,
    ) -> AsyncGenerator[dict, None]:
        """
        Async generator for the /chat/stream endpoint.
        Yields SSE event dicts: {t:"delta",c:str}, {t:"override",c:str},
        {t:"done",m:metadata}, or {t:"error",d:str}.
        Simulation path is not supported — use /chat with X-Simulate-Failure.
        """
        specs = self.settings.deployment_specs
        primary_model = specs[0].model

        async with sessions.hold(req.session_id):
            history, stored_prompt = await storage.read_context(
                self.settings.db_path, req.session_id
            )
            effective_prompt = (
                req.system_prompt if req.system_prompt is not None else stored_prompt
            )
            messages = build_messages(effective_prompt, history, req.message)

            # Cache hit — deliver full content in one delta, then done
            cached = await llm_cache.find_answer(self.cache, primary_model, messages)
            if cached is not None:
                safe_content = safe_response(cached.content)
                yield {"t": "delta", "c": safe_content}

                latency_ms = int((time.monotonic() - started_at) * 1000)
                metadata_dict = {
                    "resolution_source": ResolutionSource.LLM_CACHE.value,
                    "model": cached.model,
                    "latency_ms": latency_ms,
                    "input_tokens": cached.input_tokens,
                    "output_tokens": cached.output_tokens,
                    "key_id": None,
                    "fallback_attempts": 0,
                }
                await storage.commit_turn(
                    self.settings.db_path,
                    req.session_id,
                    effective_prompt,
                    req.message,
                    safe_content,
                    metadata_dict,
                )
                yield {"t": "done", "m": metadata_dict}
                return

            # Live streaming
            full_content = ""
            answer: ResolvedAnswer | None = None

            try:
                async for event in llm_routing.stream_complete(
                    self.router, specs, messages
                ):
                    if isinstance(event, str):
                        full_content += event
                        yield {"t": "delta", "c": event}
                    else:
                        answer = event
            except AllProvidersUnavailableError:
                yield {"t": "error", "d": "all providers unavailable"}
                return
            except Exception:
                yield {"t": "error", "d": "internal server error"}
                return

            if answer is None:
                yield {"t": "error", "d": "no response from provider"}
                return

            # Apply output guardrails — if jailbreak compliance detected, override
            safe_content = safe_response(full_content)
            if safe_content != full_content:
                yield {"t": "override", "c": safe_content}
                full_content = safe_content

            await llm_cache.store_answer(
                self.cache,
                answer.model,
                messages,
                CachedAnswer(
                    content=full_content,
                    model=answer.model,
                    input_tokens=answer.input_tokens,
                    output_tokens=answer.output_tokens,
                ),
            )
            latency_ms = int((time.monotonic() - started_at) * 1000)
            metadata_dict = {
                "resolution_source": ResolutionSource.LIVE_INFERENCE.value,
                "model": answer.model,
                "latency_ms": latency_ms,
                "input_tokens": answer.input_tokens,
                "output_tokens": answer.output_tokens,
                "key_id": answer.key_id,
                "fallback_attempts": answer.fallback_attempts,
            }
            await storage.commit_turn(
                self.settings.db_path,
                req.session_id,
                effective_prompt,
                req.message,
                full_content,
                metadata_dict,
            )
            yield {"t": "done", "m": metadata_dict}
