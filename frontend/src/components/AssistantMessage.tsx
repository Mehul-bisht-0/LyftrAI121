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
  const modelShort = metadata ? (metadata.model.split("/").pop() ?? metadata.model) : "";
  const hasFallback = (metadata?.fallback_attempts ?? 0) > 0;

  return (
    <div
      data-testid="assistant-message"
      className="flex items-end gap-2 max-w-[80%]"
    >
      {/* Avatar — teal-bordered square */}
      <div
        className="w-5 h-5 rounded-sm flex items-center justify-center shrink-0 mb-1 font-mono text-xs"
        style={{
          background: "hsl(var(--accent-bg))",
          border: "1px solid hsl(var(--accent) / 0.3)",
          color: "hsl(var(--accent))",
          fontFamily: "monospace",
          fontSize: "10px",
        }}
        aria-hidden="true"
      >
        R
      </div>

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
                {isCache ? "LLM_CACHE" : "LIVE"}
              </span>
            </span>

            <MetaChip icon={Layers} value={modelShort}                     testId="meta-model"          />
            <MetaChip icon={Clock}  value={`${metadata.latency_ms}ms`}     testId="meta-latency"        />
            <MetaChip icon={Layers} value={`${metadata.input_tokens}in`}   testId="meta-input-tokens"   />
            <MetaChip icon={Layers} value={`${metadata.output_tokens}out`} testId="meta-output-tokens"  />
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
