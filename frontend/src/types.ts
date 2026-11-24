export interface ReplyMetadata {
  resolution_source: "LIVE_INFERENCE" | "LLM_CACHE";
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  key_id: string | null;
  fallback_attempts: number;
}

export interface ChatRequest {
  session_id: string;
  message: string;
  system_prompt?: string;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  metadata: ReplyMetadata;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: ReplyMetadata;
}

export interface HistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
}

/** Internal display model for the chat UI */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  metadata?: ReplyMetadata;
  streaming?: boolean;
}

/** SSE event types from /chat/stream */
export type StreamEvent =
  | { t: "delta";    c: string }
  | { t: "override"; c: string }
  | { t: "done";     m: ReplyMetadata }
  | { t: "error";    d: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
