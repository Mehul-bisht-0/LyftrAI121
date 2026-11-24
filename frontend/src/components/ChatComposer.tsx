import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

const MAX_CHARS = 4000;

export function ChatComposer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const remaining = MAX_CHARS - value.length;
  const nearLimit = remaining < 400;
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className="shrink-0 px-4 py-3 border-t"
      style={{
        background: "hsl(var(--surface))",
        borderColor: "hsl(var(--border-dim))",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="flex items-end gap-3 rounded-xl border px-4 py-2.5 transition-all duration-150"
          style={{
            background: "hsl(var(--elevated))",
            borderColor: "hsl(var(--border))",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--accent) / 0.4)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px hsl(var(--accent) / 0.07)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--border))";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Relay AI…"
            disabled={disabled}
            rows={1}
            maxLength={MAX_CHARS}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
            style={{
              color: "hsl(var(--text))",
              minHeight: "24px",
              maxHeight: "160px",
              fontFamily: "inherit",
            }}
          />

          <div className="flex items-center gap-2 shrink-0 self-end">
            {nearLimit && (
              <span
                className="text-xs tabular-nums font-mono"
                style={{
                  color: remaining < 100 ? "hsl(var(--error))" : "hsl(var(--text-dim))",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                }}
              >
                {remaining}
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send"
              data-testid="send-button"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0"
              style={
                canSend
                  ? {
                      background: "hsl(var(--accent))",
                      color: "hsl(var(--bg))",
                      boxShadow: "0 0 10px hsl(var(--accent) / 0.3)",
                    }
                  : {
                      background: "hsl(var(--border))",
                      color: "hsl(var(--text-dim))",
                    }
              }
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <p
          className="text-center mt-2"
          style={{
            color: "hsl(var(--text-dim))",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
          }}
        >
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
