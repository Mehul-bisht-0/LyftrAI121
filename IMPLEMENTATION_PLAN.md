# Relay AI implementation plan

**Review draft · 24 November 2026.** The six-page Lyftr AI assignment defines the acceptance contract. The project owner's planning message is the finalized blueprint. Build work starts after plan approval. The deadline runs from receipt of the assignment, including time already spent. Record the receipt time and remaining hours before starting.

Ship one vertical path first: an anonymous browser on Vercel sends one new message to Railway, the backend answers using a real provider, and the committed exchange survives a redeployment. Add the precisely testable cache and failover behavior before the Resilience Lab or visual polish. Two external gates control sign-off: usable free credentials for **both** models and a Railway deployment that can both reach them and retain SQLite on a volume.

## 1. Assignment compliance matrix

| Requirement | Owner and implementation | Evidence required to sign off |
| --- | --- | --- |
| §1, §2, §7. React, Python/FastAPI, SQLite, public delivery in 24 hours | Phases 1–7. Modular backend, static frontend, one public repository | Anonymous frontend URL, backend URL, repository and narrated video |
| §2–3. Exactly three JSON API routes and a ready health response | API routes and application lifespan. Disable generated docs, ReDoc and OpenAPI routes. CORS middleware handles preflight | Enumerate application routes. Exercise all three at the public base URL |
| §2–3. Backend-owned multi-turn history | Session lock, ordered SQLite reads, server-composed messages, one transaction per successful exchange | Two turns remember an earlier fact. Separate session is isolated. GET shows committed turns oldest first |
| §2–4. At least two keys, ordered failover for rate, quota and upstream 5xx | Ordered key registry, one physical deployment per routing group, embedded SDK Router. Header injection at the attempted deployment | Trace and transport counts for primary success, secondary success and exhaustion. Exact 503 body and unchanged history |
| §2–3. Built-in response cache, exact identity and per-request metadata | LiteLLM local Cache, actual qualified model and complete ordered messages. Original usage on hit | Same first turn in two sessions gives live then faster cache, identical text and usage. Changed model, prompt, order or context cannot return the wrong record |
| §3. Validation, unknown sessions and atomic storage | Pydantic request rules, JSON errors, SQLite transaction after a usable answer | 422 matrix, exact GET 404, fresh and existing session failure tests, rollback after first insert |
| §4. Request-only test hook, enabled in production | Parse the header when enabled, bypass cache for that request, keep the real surviving provider call | key_1=429 and key_1=500 → key_2. *=429 and two-key failure → exact 503. A simultaneous ordinary request starts with key_1 |
| §5. Exact browser selectors, per-reply metadata and new session per page load | Typed chat client, per-document session ID, assistant message component | DOM tests scoped to each assistant reply, network-body assertions, reload test and readable 422/503 |
| §6–7. Local stack and configuration | Both multi-stage Dockerfiles, root docker-compose.yml, Makefile, named /data volume, .env.example | Clean make up, browser on port 3000, API on port 8000. Recreate containers and read the same stored history |
| §2, §5–8. Connected deployments, tests, README and demo | Production smoke, public reachability check and submission checklist | Signed-out browser, working CORS on success and error, six literal README headings, evidence of cache, fallback, tokens and persistence |

**Priority convention.** P0 means a PDF requirement. A blueprint requirement remains a release condition even where the feature list calls it P1: request-scoped tracking, same-session serialization, single-worker deployment and failure injection isolation protect P0 behavior. CI is required by the chosen delivery workflow. The interactive Lab and custom-prompt UI are P1. A client-supplied system prompt and its backend semantics are part of the API from the first working chat. P2 features draw exclusively from the contingency window.

## 2. Contracts to freeze before implementation

### HTTP surface

| Route | Request | Successful response |
| --- | --- | --- |
| GET /health | No body | 200 JSON `{"status":"ok","keys_configured":2,"cache_enabled":true}` for the two-key deployment. Report the actual loaded count. Readiness requires a reachable initialized DB, loaded pool and configured cache. Health checks consume zero inference quota |
| POST /chat | JSON `{"session_id":"s-7f3a","message":"What is the capital of France?"}`. Optional string `system_prompt` | 200 JSON with exactly the required `session_id`, nonempty `reply`, and a `metadata` object as defined below |
| GET /sessions/{session_id}/messages | URL-encoded session ID | 200 JSON `{"session_id":"s-7f3a","messages":[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi","metadata":{…}}]}`. All seven stored metadata fields on every assistant item. Omit metadata for user items. Exclude the system prompt |

| Metadata field | Contract |
| --- | --- |
| resolution_source | String enum `LIVE_INFERENCE` or `LLM_CACHE` |
| model | Qualified LiteLLM name of the model that actually supplied this answer, including when it came from cache |
| latency_ms | Nonnegative integer. Use a monotonic clock for **this** server request, including lock wait, context assembly and resolution. Take the final timestamp at the same persistence boundary on both paths. Store the same reported value in history |
| input_tokens, output_tokens | Nonnegative integers from this completion's prompt and completion usage. Prompt usage includes the effective system prompt, history and latest message. Preserve original counts on cache hits. Do not add the failed provider's usage or sum previous requests |
| key_id | Stable public pool identifier such as `key_1` or `key_2` for a live winner. JSON null on cache hits |
| fallback_attempts | Number of keys that actually failed before the live winner. Integer 0 for a primary success and for every cache hit |

**Validation.** Preserve the supplied session ID exactly on successful requests. Require a string, 1–128 characters, reject empty or whitespace-only IDs. Trim the message once, then require 1–4000 characters inclusive. Use strict string inputs and the same normalized message for storage, inference and cache identity. A previously unseen valid ID starts a session on its first successful POST. An omitted system prompt uses the stored override or the fixed default. A provided string replaces the override for that session upon successful commit. Treat an explicitly empty string as an empty override and include the matching system entry consistently. These last two empty/omitted semantics are implementation choices. The frontend sends only the three permitted fields and omits an unset override.

| Condition | Response and state |
| --- | --- |
| Missing field, wrong type, invalid length, invalid JSON | 422 JSON with a `detail` field. FastAPI's validation shape is acceptable. No history or prompt mutation |
| All configured keys fail | 503 `{"detail":"all providers unavailable"}` exactly. No session creation, stored prompt change or half-turn |
| Unknown session in history GET | 404 `{"detail":"session not found"}` exactly |
| A storage/internal fault outside the assignment examples | Sanitized JSON with `detail` and a server error status. Roll back a failed transaction. Return readiness failure when storage is unavailable. Keep diagnostics server-side |

**Test hook.** `X-Simulate-Failure` accepts comma-separated `<key_id>=<status>` pairs. The wildcard `*` covers every configured key. Allowed simulated statuses are exactly 429, 500, 502 and 503. Honor the header only if `ENABLE_FAILURE_SIMULATION=true`. When disabled, ignore it entirely and use normal caching. Define otherwise unspecified parsing for repeatability: trim adjacent whitespace, reject malformed pairs, unknown key IDs, duplicate selectors or unsupported statuses with JSON 422 before inference or writes. A specific selector overrides a wildcard. Bypass cache reads and writes on every enabled, valid simulated request, including one targeting only the secondary. A successful response must contain real provider text.

### SQLite and concurrency

Use `DATABASE_URL=sqlite:////data/app.db` in Compose and Railway. For native development document `sqlite:///./data/app.db`. Parse the SQLite URL deliberately, preserve an absolute path's leading slash, and reject unsupported schemes or a missing production volume. Create the schema during application lifespan. Parameter-bind all values.

| Object | Columns and rules |
| --- | --- |
| sessions | `session_id TEXT PRIMARY KEY`, nullable `system_prompt TEXT`. An absent row represents an unknown session |
| messages | `id INTEGER PRIMARY KEY AUTOINCREMENT`, `session_id TEXT NOT NULL` referencing sessions, `role TEXT NOT NULL` constrained to user or assistant, `content TEXT NOT NULL`, nullable `metadata TEXT` containing assistant-only JSON, `created_at TEXT NOT NULL` UTC ISO-8601 server time |
| Index and order | Index `messages(session_id,id)`. Always select by session ID and order by id ascending. Two messages may share the same timestamp |

Hold a per-session `asyncio.Lock` from the context read through the commit. Keep a registry under a short guard with references for holders **and waiters**. Clean up on release and cancellation without removing a lock that another task still uses. Different sessions may perform inference concurrently. Use separate aiosqlite connections for isolated operations or transactions, enable foreign keys per connection, WAL on initialization and a finite busy timeout. No SQLite write transaction spans a provider call. After a valid answer, start a short transaction, upsert the session/prompt, insert user then assistant, and commit before the HTTP 200. On insert failure or pre-commit cancellation roll back and close. Cancellation after commit can leave a committed exchange even if the client lost its response. A blind POST retry can therefore add a new turn. [SQLite isolation](https://www.sqlite.org/isolation.html)

## 3. Architecture and file ownership

Browser → React chat client → FastAPI validation → session lock → SQLite context read → LiteLLM response cache → embedded Router on a miss → Gemini, then Groq if needed → validated answer and usage → atomic SQLite commit → JSON reply. On a hit the same commit path stores the new session's exchange. SQLite is the history authority. One process owns the router, response cache and lock registry. Use one Uvicorn worker and one Railway replica. A restart clears the in-memory cache and leaves committed history on the volume.

The following paths are planned deliverables. Create them with their owning slice. Names in the interface column are application interfaces to implement. Exact third-party calls are identified separately under Phase 0.

| Path | Responsibility and interface |
| --- | --- |
| backend/app/main.py | `create_app(settings)` and lifespan. Initialize DB, cache, immutable key registry and Router, install CORS and sanitized error handling, close resources on shutdown |
| backend/app/config.py | `Settings.from_env()`, `DeploymentSpec(key_id, model, routing_group, secret)`, SQLite URL and origin parsing, ordered secret-to-key mapping |
| backend/app/contracts.py | `ChatRequest`, `ChatResponse`, `ReplyMetadata`, `HealthResponse`, `UserMessage`, `AssistantMessage`, `HistoryResponse`, resolution-source enum. Output models enforce types and live/cache invariants |
| backend/app/routes.py | Three route handlers. Start timing, parse or ignore the simulation header, invoke the service, map domain failures to JSON |
| backend/app/storage.py | `initialize()`, `check_ready()`, `read_context(session_id)`, `read_history(session_id)`, `commit_turn(...)`. SQL and transaction ownership |
| backend/app/sessions.py | `SessionLocks.hold(session_id)` async context manager. Safe release on errors, waiting-task cancellation and idle-cell cleanup |
| backend/app/chat.py | `ChatService.send(request, simulation, started_at)`, `build_messages(...)`. Resolve effective prompt, load ordered turns, resolve inference, assemble metadata and commit |
| backend/app/llm/cache.py | `find_answer(models,messages)`, `store_answer(model,messages,answer)`. Only LiteLLM's built-in local Cache holds responses. Validate stored model and per-request usage on retrieval |
| backend/app/llm/routing.py | `build_router(specs)`, `complete(messages, plan)`, immutable deployment map, `ResolvedAnswer` and normalized errors. Validate nonempty visible assistant text and usage |
| backend/app/llm/attempts.py | `parse_simulation(header,slots)`, `AttemptTrace`, request context and selected attempt-boundary adapter. Track actual attempts, inject only for listed IDs, reset context in finally |
| backend/tests/ | Contract/API, session/transaction, real Router/Cache and isolation suites. Provider HTTP fixtures are test-only, compare exact attempts, wire calls and usage |
| backend/requirements.in, backend/requirements.lock, backend/requirements-dev.* | Direct runtime constraints and exact hash-checked runtime/dev locks. Dev includes pytest, async test support and HTTPX |
| backend/Dockerfile, backend/.dockerignore | Multi-stage dependency build and small non-root runtime using the production lock and a single worker |
| frontend/src/api.ts, frontend/src/types.ts | `postChat(body,options)`, `getHistory(id)`, typed metadata and safe display errors. Public backend URL from Vite config |
| frontend/src/App.tsx, frontend/src/components/ChatComposer.tsx, MessageList.tsx, AssistantMessage.tsx | Session identity per document, ordered turn state, pending/error state, input and send interactions, metadata selectors in each reply |
| frontend/src/components/ResilienceLab.tsx, frontend/src/components/ui/ | P1 controls for optional prompt and request-specific simulated failures. Use only the shadcn components actually rendered |
| frontend/src/main.tsx, frontend/src/index.css, frontend/vite.config.ts, frontend/index.html, frontend/components.json | React entry, Tailwind and shadcn integration, build settings and SPA entry |
| frontend/package.json, frontend/package-lock.json, frontend/tsconfig*.json, frontend/Dockerfile, frontend/.dockerignore | Pinned client/build tools, TypeScript configs, reproducible multi-stage static image |
| frontend/src/**/*.test.tsx, frontend/e2e/chat.spec.ts | DOM-level contract tests and browser tests with controlled responses, plus an opt-in public smoke |
| docker-compose.yml, Makefile, .env.example, .gitignore, .github/workflows/ci.yml, README.md | Local orchestration, redacted config, CI, deployment and evaluator instructions |

