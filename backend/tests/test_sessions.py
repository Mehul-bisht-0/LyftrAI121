"""Session lock tests."""
from __future__ import annotations

import asyncio
import pytest
from app import sessions


async def test_single_acquire():
    async with sessions.hold("test-s1"):
        pass  # Should not block


async def test_different_sessions_concurrent():
    order = []

    async def task(sid, label):
        async with sessions.hold(sid):
            order.append(label)
            await asyncio.sleep(0.01)

    await asyncio.gather(task("a", "a"), task("b", "b"))
    assert set(order) == {"a", "b"}


async def test_same_session_serialized():
    results = []

    async def task(value):
        async with sessions.hold("shared"):
            results.append(value)
            await asyncio.sleep(0.01)
            results.append(value + "_done")

    await asyncio.gather(task("x"), task("y"))
    # Tasks serialized: one completes fully before the other starts
    assert results.index("x_done") < results.index("y") or \
           results.index("y_done") < results.index("x")
