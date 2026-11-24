from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Optional


@dataclass
class CachedAnswer:
    content: str
    model: str
    input_tokens: int
    output_tokens: int


def _cache_key(model: str, messages: list[dict]) -> str:
    payload = json.dumps(
        [1, model, messages],
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


async def find_answer(
    cache, model: str, messages: list[dict]
) -> Optional[CachedAnswer]:
    key = _cache_key(model, messages)
    hit = await cache.async_get_cache(cache_key=key, messages=messages)
    if hit is None:
        return None
    return CachedAnswer(
        content=hit.get("content", ""),
        model=hit.get("model", model),
        input_tokens=hit.get("input_tokens", 0),
        output_tokens=hit.get("output_tokens", 0),
    )


async def store_answer(
    cache, model: str, messages: list[dict], answer: CachedAnswer
) -> None:
    key = _cache_key(model, messages)
    await cache.async_add_cache(
        {
            "content": answer.content,
            "model": answer.model,
            "input_tokens": answer.input_tokens,
            "output_tokens": answer.output_tokens,
        },
        cache_key=key,
        messages=messages,
    )
