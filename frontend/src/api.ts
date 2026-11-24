import type { ChatRequest, ChatResponse, HistoryResponse, StreamEvent } from "./types";
import { ApiError } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function handleResponse<T>(resp: Response): Promise<T> {
  if (resp.ok) {
    return resp.json() as Promise<T>;
  }
  let detail = `HTTP ${resp.status}`;
  try {
    const body = await resp.json();
    if (body?.detail) detail = body.detail;
  } catch {
    // ignore parse error
  }
  throw new ApiError(resp.status, detail);
}

export async function postChat(
  body: ChatRequest,
  options?: {
    signal?: AbortSignal;
    simulationHeader?: string;
  }
): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.simulationHeader) {
    headers["X-Simulate-Failure"] = options.simulationHeader;
  }
  const resp = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleResponse<ChatResponse>(resp);
}

export async function* streamChat(
  body: ChatRequest,
  options?: { signal?: AbortSignal }
): AsyncGenerator<StreamEvent, void, unknown> {
  const resp = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch { /* ignore */ }
    throw new ApiError(resp.status, detail);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new ApiError(0, "No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as StreamEvent;
          } catch { /* ignore malformed JSON */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getHistory(
  sessionId: string
): Promise<HistoryResponse> {
  const resp = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/messages`
  );
  return handleResponse<HistoryResponse>(resp);
}
