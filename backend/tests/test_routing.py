"""Routing tests — mocked LiteLLM calls, no real API."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.config import DeploymentSpec
from app.llm.attempts import SimulationPlan
from app.llm.routing import (
    AllProvidersUnavailableError,
    ResolvedAnswer,
    _simulated_complete,
    _normal_complete,
    complete,
)


SPECS = [
    DeploymentSpec(key_id="key_1", model="gemini/gemini-2.5-flash-lite",
                   routing_group="primary", secret="k1"),
    DeploymentSpec(key_id="key_2", model="groq/llama-3.1-8b-instant",
                   routing_group="fallback", secret="k2"),
]


def _make_resp(content="Hello", model="gemini/gemini-2.5-flash-lite",
               input_tokens=10, output_tokens=5):
    resp = MagicMock()
    resp.choices[0].message.content = content
    resp.model = model
    resp.usage.prompt_tokens = input_tokens
    resp.usage.completion_tokens = output_tokens
    return resp


async def test_normal_primary_success():
    router = MagicMock()
    router.acompletion = AsyncMock(return_value=_make_resp(model="gemini/gemini-2.5-flash-lite"))
    result = await _normal_complete(router, SPECS, [{"role": "user", "content": "hi"}])
    assert result.key_id == "key_1"
    assert result.fallback_attempts == 0
    assert result.cache_hit is False


async def test_normal_fallback_detected():
    router = MagicMock()
    router.acompletion = AsyncMock(
        return_value=_make_resp(model="groq/llama-3.1-8b-instant")
    )
    result = await _normal_complete(router, SPECS, [{"role": "user", "content": "hi"}])
    assert result.key_id == "key_2"
    assert result.fallback_attempts == 1


async def test_normal_all_fail():
    router = MagicMock()
    router.acompletion = AsyncMock(side_effect=Exception("both failed"))
    with pytest.raises(AllProvidersUnavailableError):
        await _normal_complete(router, SPECS, [{"role": "user", "content": "hi"}])


async def test_simulation_key1_fail_key2_wins(mocker):
    mock_resp = _make_resp(content="Groq reply", model="groq/llama-3.1-8b-instant")
    mocker.patch("app.llm.routing.litellm.acompletion", new_callable=AsyncMock,
                 return_value=mock_resp)
    sim = SimulationPlan(per_key={"key_1": 429})
    result = await _simulated_complete(SPECS, [{"role": "user", "content": "hi"}], sim)
    assert result.key_id == "key_2"
    assert result.fallback_attempts == 1
    assert result.content == "Groq reply"


async def test_simulation_all_fail():
    sim = SimulationPlan(wildcard=429)
    with pytest.raises(AllProvidersUnavailableError):
        await _simulated_complete(SPECS, [{"role": "user", "content": "hi"}], sim)


async def test_simulation_specific_overrides_wildcard(mocker):
    mock_resp = _make_resp(content="ok", model="groq/llama-3.1-8b-instant")
    mocker.patch("app.llm.routing.litellm.acompletion", new_callable=AsyncMock,
                 return_value=mock_resp)
    # key_1 specifically fails, wildcard would also fail key_2 but specific key wins
    # key_2 has no specific rule → wildcard applies → key_2 also fails
    sim = SimulationPlan(per_key={"key_1": 429}, wildcard=500)
    with pytest.raises(AllProvidersUnavailableError):
        await _simulated_complete(SPECS, [{"role": "user", "content": "hi"}], sim)


async def test_simulation_isolation(mocker):
    """Two concurrent requests: one simulated, one normal. Normal uses key_1."""
    import asyncio

    mock_resp_groq = _make_resp(content="fallback", model="groq/llama-3.1-8b-instant")
    mock_resp_gemini = _make_resp(content="primary", model="gemini/gemini-2.5-flash-lite")

    router = MagicMock()
    call_count = 0

    async def mock_router_complete(*args, **kwargs):
        return mock_resp_gemini

    router.acompletion = mock_router_complete

    async def mock_litellm_complete(*args, **kwargs):
        return mock_resp_groq

    mocker.patch("app.llm.routing.litellm.acompletion", side_effect=mock_litellm_complete)

    sim = SimulationPlan(per_key={"key_1": 429})
    msgs = [{"role": "user", "content": "hi"}]

    result_sim, result_normal = await asyncio.gather(
        complete(router, SPECS, msgs, sim=sim),
        complete(router, SPECS, msgs, sim=None),
    )
    assert result_sim.key_id == "key_2"
    assert result_normal.key_id == "key_1"
