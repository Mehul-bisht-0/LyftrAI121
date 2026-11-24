"""LiteLLM local cache identity tests — real Cache, no network."""
from __future__ import annotations

import pytest
from litellm.caching.caching import Cache

from app.llm.cache import CachedAnswer, find_answer, store_answer


@pytest.fixture
def cache():
    return Cache(type="local", ttl=1800)


MESSAGES = [
    {"role": "system", "content": "Be concise."},
    {"role": "user", "content": "What is 2+2?"},
]

ANSWER = CachedAnswer(
    content="4",
    model="gemini/gemini-2.5-flash-lite",
    input_tokens=12,
    output_tokens=1,
)


async def test_cache_miss(cache):
    result = await find_answer(cache, "gemini/gemini-2.5-flash-lite", MESSAGES)
    assert result is None


async def test_cache_hit_after_store(cache):
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    result = await find_answer(cache, ANSWER.model, MESSAGES)
    assert result is not None
    assert result.content == "4"
    assert result.input_tokens == 12


async def test_cache_model_separation(cache):
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    # Different model → miss
    result = await find_answer(cache, "groq/llama-3.1-8b-instant", MESSAGES)
    assert result is None


async def test_cache_message_order_separation(cache):
    reversed_msgs = list(reversed(MESSAGES))
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    result = await find_answer(cache, ANSWER.model, reversed_msgs)
    assert result is None


async def test_cache_system_prompt_separation(cache):
    different_prompt = [{"role": "system", "content": "Different prompt."}] + MESSAGES[1:]
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    result = await find_answer(cache, ANSWER.model, different_prompt)
    assert result is None


async def test_cache_content_separation(cache):
    different_msg = MESSAGES[:-1] + [{"role": "user", "content": "What is 3+3?"}]
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    result = await find_answer(cache, ANSWER.model, different_msg)
    assert result is None


async def test_cache_usage_preserved(cache):
    await store_answer(cache, ANSWER.model, MESSAGES, ANSWER)
    result = await find_answer(cache, ANSWER.model, MESSAGES)
    assert result is not None
    assert result.input_tokens == ANSWER.input_tokens
    assert result.output_tokens == ANSWER.output_tokens
