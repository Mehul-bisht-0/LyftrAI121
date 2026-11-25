import { Zap, Radio, Clock, Layers, Key, GitBranch } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReplyMetadata } from "../types";

interface Props {
  content: string;
  metadata?: ReplyMetadata;
  streaming?: boolean;
}

function MetaChip({
  icon: Icon,
  value,
  accent,
  testId,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  value: string;
  accent?: boolean;
  testId: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border"
      style={
        accent
          ? {
              color: "hsl(var(--success))",
              borderColor: "hsl(var(--success) / 0.2)",
              background: "hsl(var(--success) / 0.06)",
            }
          : {
              color: "hsl(var(--text-dim))",
              borderColor: "hsl(var(--border-dim))",
              background: "transparent",
            }
      }
    >
      <Icon size={9} strokeWidth={2} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
        {value}
      </span>
    </span>
  );
}

export function AssistantMessage({ content, metadata, streaming }: Props) {
  const isCache = metadata?.resolution_source === "LLM_CACHE";
  const hasFallback = (metadata?.fallback_attempts ?? 0) > 0;

  return (
    <div
      data-testid="assistant-message"
      className="flex items-end gap-2 max-w-[80%]"
    >
      {/* Avatar — relay node icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 mb-1"
      >
        <circle cx="4" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.9" />
        <line x1="6.5" y1="11" x2="15.5" y2="11" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.4" strokeLinecap="round" />
        <circle cx="18" cy="11" r="2.5" fill="hsl(var(--accent))" opacity="0.55" />
        <line x1="11" y1="11" x2="11" y2="5" stroke="hsl(var(--accent))" strokeWidth="1.25" strokeOpacity="0.3" strokeLinecap="round" />
        <circle cx="11" cy="4" r="1.5" fill="hsl(var(--accent))" opacity="0.35" />
      </svg>

      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Reply bubble */}
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed border"
          style={{
            background: "hsl(var(--surface))",
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--text))",
          }}
        >
          {streaming ? (
            <span className="whitespace-pre-wrap break-words">
              {content}
              <span className="animate-cursor" aria-hidden="true">▌</span>
            </span>
          ) : (
            <div className="relay-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata chips — only when complete */}
        {metadata && !streaming && (
          <div className="flex flex-wrap gap-1 pl-0.5">
            {/* Source — most prominent */}
            <span
              data-testid="meta-source"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold"
              style={
                isCache
                  ? {
                      color: "hsl(var(--success))",
                      borderColor: "hsl(var(--success) / 0.2)",
                      background: "hsl(var(--success) / 0.08)",
                      fontSize: "10px",
                    }
                  : {
                      color: "hsl(var(--accent))",
                      borderColor: "hsl(var(--accent) / 0.2)",
                      background: "hsl(var(--accent-bg))",
                      fontSize: "10px",
                    }
              }
            >
              {isCache
                ? <Zap size={9} strokeWidth={2} />
                : <Radio size={9} strokeWidth={2} />
              }
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {isCache ? "LLM_CACHE" : "LIVE_INFERENCE"}
              </span>
            </span>

            <MetaChip icon={Layers} value={metadata.model}                  testId="meta-model"          />
            <MetaChip icon={Clock}  value={`${metadata.latency_ms} ms`}     testId="meta-latency"        />
            <MetaChip icon={Layers} value={`${metadata.input_tokens}`}     testId="meta-input-tokens"   />
            <MetaChip icon={Layers} value={`${metadata.output_tokens}`}    testId="meta-output-tokens"  />
            <MetaChip
              icon={Key}
              value={metadata.key_id ?? "cache"}
              testId="metadata-key"
            />
            <MetaChip
              icon={GitBranch}
              value={hasFallback ? `${metadata.fallback_attempts}↩` : "primary"}
              accent={hasFallback}
              testId="metadata-fallback"
            />
          </div>
        )}
      </div>
    </div>
  );
}
