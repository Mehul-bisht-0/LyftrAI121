import { useEffect, useRef } from "react";
import { Sparkles, Code2, BookOpen } from "lucide-react";
import type { DisplayMessage } from "../types";
import { AssistantMessage } from "./AssistantMessage";

interface Props {
  messages: DisplayMessage[];
  pending: boolean;
  onSuggest: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: Sparkles,
    label: "Explain a concept",
    prompt: "Explain quantum entanglement in simple terms.",
  },
  {
    icon: Code2,
    label: "Write code",
    prompt: "Write a Python function to find duplicates in a list.",
  },
  {
    icon: BookOpen,
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
          <div className="flex flex-col items-center pt-16 pb-8 select-none animate-fade-up">
            {/* Logo */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-5"
              style={{
                background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(239 90% 55%) 100%)",
                boxShadow: "0 0 32px hsl(var(--accent) / 0.3), 0 0 64px hsl(var(--accent) / 0.1)",
              }}
            >
              R
            </div>
            <h2
              className="text-xl font-semibold mb-1"
              style={{ color: "hsl(var(--text))" }}
            >
              How can I help you?
            </h2>
            <p className="text-sm mb-8" style={{ color: "hsl(var(--text-muted))" }}>
              Fault-tolerant · Guardrails enforced · LiteLLM routing
            </p>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => onSuggest(prompt)}
                  className="group flex flex-col items-start gap-2 px-4 py-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: "hsl(var(--surface))",
                    borderColor: "hsl(var(--border))",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--accent) / 0.5)";
                    (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--elevated))";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--border))";
                    (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--surface))";
                  }}
                >
                  <Icon size={16} style={{ color: "hsl(var(--accent))" }} />
                  <span className="text-xs font-medium" style={{ color: "hsl(var(--text-muted))" }}>
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
            style={{ animationDelay: `${i * 20}ms` }}
          >
            {/* User bubble */}
            {msg.role === "user" && (
              <div
                className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-words text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(239 70% 50%) 0%, hsl(265 60% 45%) 100%)",
                  boxShadow: "0 2px 12px hsl(var(--accent) / 0.3)",
                }}
              >
                {msg.content}
              </div>
            )}

            {/* Assistant message (shown while streaming or once complete) */}
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
                className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed border"
                style={{
                  background: "hsl(var(--error) / 0.08)",
                  borderColor: "hsl(var(--error) / 0.25)",
                  color: "hsl(var(--error))",
                }}
              >
                <span className="font-semibold">Error: </span>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* ── Typing indicator (hidden while a streaming message is live) ── */}
        {pending && !messages.some((m) => m.streaming) && (
          <div className="flex justify-start animate-fade-up">
            <div className="flex items-center gap-1.5">
              {/* Avatar */}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 self-end mb-1"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(239 90% 55%) 100%)",
                }}
              >
                R
              </div>
              <div
                className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-sm border"
                style={{
                  background: "hsl(var(--surface))",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-1"
                  style={{ background: "hsl(var(--text-muted))" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-2"
                  style={{ background: "hsl(var(--text-muted))" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-dot-3"
                  style={{ background: "hsl(var(--text-muted))" }}
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
