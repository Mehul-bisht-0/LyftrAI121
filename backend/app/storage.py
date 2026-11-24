from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import aiosqlite


async def initialize(db_path: str) -> None:
    dir_name = os.path.dirname(db_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.execute("PRAGMA busy_timeout=5000")
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                system_prompt TEXT
            )
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL REFERENCES sessions(session_id),
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_messages_session
            ON messages(session_id, id)
            """
        )
        await conn.commit()


async def check_ready(db_path: str) -> bool:
    try:
        async with aiosqlite.connect(db_path, timeout=2.0) as conn:
            await conn.execute("SELECT 1 FROM sessions LIMIT 1")
        return True
    except Exception:
        return False


async def read_context(
    db_path: str, session_id: str
) -> tuple[list[dict], str | None]:
    async with aiosqlite.connect(db_path, timeout=5.0) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        async with conn.execute(
            "SELECT system_prompt FROM sessions WHERE session_id=?",
            (session_id,),
        ) as cur:
            row = await cur.fetchone()
            stored_prompt = row["system_prompt"] if row else None
        async with conn.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY id ASC",
            (session_id,),
        ) as cur:
            rows = await cur.fetchall()
    messages = [{"role": r["role"], "content": r["content"]} for r in rows]
    return messages, stored_prompt


async def read_history(
    db_path: str, session_id: str
) -> list[dict] | None:
    async with aiosqlite.connect(db_path, timeout=5.0) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys=ON")
        async with conn.execute(
            "SELECT 1 FROM sessions WHERE session_id=?", (session_id,)
        ) as cur:
            if await cur.fetchone() is None:
                return None
        async with conn.execute(
            "SELECT role, content, metadata FROM messages WHERE session_id=? ORDER BY id ASC",
            (session_id,),
        ) as cur:
            rows = await cur.fetchall()
    result: list[dict] = []
    for r in rows:
        item: dict = {"role": r["role"], "content": r["content"]}
        if r["metadata"]:
            item["metadata"] = json.loads(r["metadata"])
        result.append(item)
    return result


async def commit_turn(
    db_path: str,
    session_id: str,
    system_prompt: str | None,
    user_message: str,
    assistant_content: str,
    metadata: dict,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(db_path, timeout=10.0) as conn:
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.execute("BEGIN IMMEDIATE")
        try:
            await conn.execute(
                """
                INSERT INTO sessions(session_id, system_prompt) VALUES(?,?)
                ON CONFLICT(session_id) DO UPDATE SET system_prompt=excluded.system_prompt
                """,
                (session_id, system_prompt),
            )
            await conn.execute(
                "INSERT INTO messages(session_id,role,content,created_at) VALUES(?,?,?,?)",
                (session_id, "user", user_message, now),
            )
            await conn.execute(
                "INSERT INTO messages(session_id,role,content,metadata,created_at) VALUES(?,?,?,?,?)",
                (
                    session_id,
                    "assistant",
                    assistant_content,
                    json.dumps(metadata),
                    now,
                ),
            )
            await conn.execute("COMMIT")
        except Exception:
            await conn.execute("ROLLBACK")
            raise
