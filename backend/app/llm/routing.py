from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import litellm

from app.config import DeploymentSpec
from app.llm.attempts import SimulationPlan


@dataclass
class ResolvedAnswer:
    content: str
    model: str
    key_id: Optional[str]
    input_tokens: int
    output_tokens: int
    cache_hit: bool
    fallback_attempts: int


class AllProvidersUnavailableError(Exception):
    pass


def build_router(specs: list[DeploymentSpec]):
    from litellm import Router

    model_list = [
        {
            "model_name": spec.routing_group,
            "litellm_params": {
                "model": spec.model,
                "api_key": spec.secret,
            },
        }
        for spec in specs
    ]
    return Router(
        model_list=model_list,
        fallbacks=[{"primary": ["fallback"]}],
        context_window_fallbacks=[{"primary": ["fallback"]}],
        allowed_fails=1,
        num_retries=0,
        cache_responses=False,
        timeout=30,
    )


def _model_to_spec_index(model: str, specs: list[DeploymentSpec]) -> int:
    for i, spec in enumerate(specs):
        if spec.model == model:
            return i
        # Suffix match: "llama-3.1-8b-instant" matches "groq/llama-3.1-8b-instant"
        suffix = spec.model.split("/")[-1]
        if model == suffix or model.endswith("/" + suffix):
            return i
    return 0


async def complete(
    router,
    specs: list[DeploymentSpec],
    messages: list[dict],
    sim: Optional[SimulationPlan] = None,
) -> ResolvedAnswer:
    if sim is None:
        return await _normal_complete(router, specs, messages)
    return await _simulated_complete(specs, messages, sim)


async def _normal_complete(
    router, specs: list[DeploymentSpec], messages: list[dict]
) -> ResolvedAnswer:
    try:
        resp = await router.acompletion(
            model="primary",
            messages=messages,
            cache={"no-cache": True, "no-store": True},
        )
    except Exception as exc:
        raise AllProvidersUnavailableError(str(exc)) from exc

    content = resp.choices[0].message.content or ""
    if not content.strip():
        raise AllProvidersUnavailableError("Empty response from provider")

    actual_model: str = resp.model or specs[0].model
    spec_index = _model_to_spec_index(actual_model, specs)
    key_id = specs[spec_index].key_id
    fallback_attempts = spec_index  # 0 for primary, 1 for first fallback, etc.

    usage = resp.usage
    input_tokens = getattr(usage, "prompt_tokens", 0) or 0
    output_tokens = getattr(usage, "completion_tokens", 0) or 0

    return ResolvedAnswer(
        content=content,
        model=actual_model,
        key_id=key_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_hit=False,
        fallback_attempts=fallback_attempts,
    )


async def _simulated_complete(
    specs: list[DeploymentSpec],
    messages: list[dict],
    sim: SimulationPlan,
) -> ResolvedAnswer:
    fallback_attempts = 0
    last_error: Exception | None = None

    for spec in specs:
        simulated_status = sim.should_fail(spec.key_id)
        if simulated_status is not None:
            last_error = Exception(
                f"Simulated {simulated_status} failure for {spec.key_id}"
            )
            fallback_attempts += 1
            continue

        try:
            resp = await litellm.acompletion(
                model=spec.model,
                messages=messages,
                api_key=spec.secret,
                cache={"no-cache": True, "no-store": True},
            )
        except Exception as exc:
            last_error = exc
            fallback_attempts += 1
            continue

        content = resp.choices[0].message.content or ""
        if not content.strip():
            last_error = Exception(f"Empty response from {spec.key_id}")
            fallback_attempts += 1
            continue

        usage = resp.usage
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0

        return ResolvedAnswer(
            content=content,
            model=spec.model,
            key_id=spec.key_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_hit=False,
            fallback_attempts=fallback_attempts,
        )

    raise AllProvidersUnavailableError(
        f"All providers unavailable: {last_error}"
    )
