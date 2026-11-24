from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

_registry: dict[str, asyncio.Lock] = {}
_registry_lock = asyncio.Lock()


@asynccontextmanager
async def hold(session_id: str) -> AsyncGenerator[None, None]:
    async with _registry_lock:
        if session_id not in _registry:
            _registry[session_id] = asyncio.Lock()
        sess_lock = _registry[session_id]
    try:
        async with sess_lock:
            yield
    finally:
        async with _registry_lock:
            waiters = getattr(sess_lock, "_waiters", None)
            if (
                session_id in _registry
                and not sess_lock.locked()
                and not waiters
            ):
                del _registry[session_id]
