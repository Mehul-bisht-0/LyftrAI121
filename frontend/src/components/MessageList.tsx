import { useEffect, useRef } from "react";
import { MessageSquare, Code2, Layers } from "lucide-react";
import type { DisplayMessage } from "../types";
import { AssistantMessage } from "./AssistantMessage";

interface Props {
  messages: DisplayMessage[];
  pending: boolean;
  onSuggest: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: MessageSquare,
    label: "Explain a concept",
    prompt: "Explain quantum entanglement in simple terms.",
  },
  {
    icon: Code2,
    label: "Write code",
    prompt: "Write a Python function to find duplicates in a list.",
  },
  {
    icon: Layers,
    label: "Best practices",
    prompt: "What are the best practices for designing a REST API?",
  },
];

export function MessageList({ messages, pending, onSuggest }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: "hsl(var(--bg))" }}
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Empty state ─────────────────────────────────── */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-20 pb-8 select-none animate-fade-up">
            {/* Wordmark */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color: "hsl(var(--text))", letterSpacing: "-0.03em" }}
              >
                RELAY
              </span>
              <span
                className="text-sm font-semibold px-1.5 py-0.5 rounded self-center"
                style={{
                  background: "hsl(var(--accent-bg))",
                  color: "hsl(var(--accent))",
                  border: "1px solid hsl(var(--accent) / 0.25)",
                }}
              >
                AI
              </span>
            </div>

            <h2
              className="text-base font-medium mb-1"
              style={{ color: "hsl(var(--text-muted))" }}
            >
              Signal ready.
            </h2>

            {/* Signal track — the one motion moment */}
            <div className="signal-track my-5">
              <div className="signal-pulse" />
            </div>

            <p
              className="text-xs mb-8 font-mono text-center"
              style={{
                color: "hsl(var(--text-dim))",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.01em",
              }}
            >
              Fault-tolerant routing · Guardrails enforced · Gemini + Groq
            </p>

            {/* Suggestion tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => onSuggest(prompt)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left transition-colors duration-150"
                  style={{
                    background: "hsl(var(--surface))",
                    borderColor: "hsl(var(--border-dim))",
                    borderLeftWidth: "2px",
                    borderLeftColor: "hsl(var(--border-dim))",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "hsl(var(--border))";
                    el.style.borderLeftColor = "hsl(var(--accent))";
                    el.style.background = "hsl(var(--elevated))";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "hsl(var(--border-dim))";
                    el.style.borderLeftColor = "hsl(var(--border-dim))";
                    el.style.background = "hsl(var(--surface))";
                  }}
                >
                  <Icon size={13} style={{ color: "hsl(var(--accent))", flexShrink: 0 }} strokeWidth={2} />
                  <span
                    className="text-xs font-medium leading-tight"
                    style={{ color: "hsl(var(--text-muted))" }}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ────────────────────────────────────── */}
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex animate-fade-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${i * 15}ms` }}
          >
            {/* User bubble */}
            {msg.role === "user" && (
              <div
                className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-words"
                style={{
                  background: "hsl(var(--accent) / 0.14)",
                  border: "1px solid hsl(var(--accent) / 0.3)",
                  color: "hsl(var(--text))",
                }}
              >
                {msg.content}
              </div>
            )}

            {/* Assistant message */}
            {msg.role === "assistant" && (msg.streaming || msg.metadata) && (
              <AssistantMessage
                content={msg.content}
                metadata={msg.metadata}
                streaming={msg.streaming}
              />
            )}

            {/* Error message */}
            {msg.role === "error" && (
              <div
                className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed border"
                style={{
                  background: "hsl(var(--error) / 0.06)",
                  borderColor: "hsl(var(--error) / 0.2)",
                  color: "hsl(var(--error))",
                }}
              >
                <span className="font-semibold">Error: </span>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* ── Typing indicator ────────────────────────────── */}
        {pending && !messages.some((m) => m.streaming) && (
          <div className="flex justify-start animate-fade-up">
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="shrink-0 self-end mb-1"
              >
                <circle cx="4" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.9" />
                <line x1="6.5" y1="11" x2="15.5" y2="11" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.4" strokeLinecap="round" />
                <circle cx="18" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.55" />
                <line x1="11" y1="11" x2="11" y2="5" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.3" strokeLinecap="round" />
                <circle cx="11" cy="4" r="1.5" fill="hsl(var(--accent))" opacity="0.35" />
              </svg>
              <div
                className="flex items-center gap-1 px-3.5 py-2.5 rounded-2xl rounded-tl-sm border"
                style={{
                  background: "hsl(var(--surface))",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-1"
                  style={{ background: "hsl(var(--text-dim))" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-2"
                  style={{ background: "hsl(var(--text-dim))" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-3"
                  style={{ background: "hsl(var(--text-dim))" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
