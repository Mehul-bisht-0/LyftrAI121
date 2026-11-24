from __future__ import annotations

import time
from typing import Optional

from app import sessions, storage
from app.config import Settings
from app.contracts import ChatRequest, ChatResponse, ReplyMetadata, ResolutionSource
from app.llm import cache as llm_cache
from app.llm import routing as llm_routing
from app.llm.attempts import SimulationPlan
from app.llm.cache import CachedAnswer
from app.llm.routing import AllProvidersUnavailableError, ResolvedAnswer


def build_messages(
    system_prompt: str | None,
    history: list[dict],
    new_message: str,
) -> list[dict]:
    messages: list[dict] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
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
                        content=cached.content,
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
                answer = await llm_routing.complete(
                    self.router, specs, messages, sim=sim
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
