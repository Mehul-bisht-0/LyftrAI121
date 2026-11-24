"""Phase 0 experiment. Requires litellm==1.110.3. Makes no provider calls."""

import asyncio
import hashlib
import json
import os
from importlib.metadata import version

os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
os.environ["LITELLM_OFFLINE_MODE"] = "true"

from litellm.caching.caching import Cache


def lookup_args(model, messages):
    identity = json.dumps(
        [1, model, messages],
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return {"cache_key": hashlib.sha256(identity).hexdigest(), "messages": messages}


async def verify():
    assert version("litellm") == "1.110.3"
    models = ("gemini/gemini-3.5-flash-lite", "groq/openai/gpt-oss-20b")
    prompt = {"role": "system", "content": "Answer in one line."}
    question = {"role": "user", "content": "What is α?"}
    first_turn = [prompt, question]
    later_turn = first_turn + [
        {"role": "assistant", "content": "First reply."},
        {"role": "user", "content": "Explain."},
        {"role": "assistant", "content": "Second reply."},
        question,
    ]
    assert not Cache(type="local").should_use_cache(messages=later_turn)
    cache = Cache(type="local", ttl=1800, max_messages=None)
    for messages in (first_turn, later_turn):
        primary, secondary = [lookup_args(model, messages) for model in models]
        assert await cache.async_get_cache(**primary) is None
        assert await cache.async_get_cache(**secondary) is None
        fallback = dict(model=models[1], reply="Secondary reply", input_tokens=30, output_tokens=7)
        await cache.async_add_cache(fallback, **secondary)
        # A repeat can consume the secondary entry before invoking a recovered primary.
        assert [await cache.async_get_cache(**args) for args in (primary, secondary)] == [None, fallback]
        variants = [
            list(reversed(messages)),
            [{"role": "system", "content": "Another prompt"}] + messages[1:],
            messages[:-1] + [{"role": "user", "content": "Another question"}],
        ]
        for variant in variants:
            assert await cache.async_get_cache(**lookup_args(models[1], variant)) is None
        direct = dict(model=models[0], reply="Primary reply", input_tokens=27, output_tokens=3)
        await cache.async_add_cache(direct, **primary)
        assert [await cache.async_get_cache(**args) for args in (primary, secondary)] == [direct, fallback]
        print(f"PASS model separation, fallback replay, usage, prompt/order/text identity ({len(messages)} messages)")


if __name__ == "__main__":
    asyncio.run(verify())
