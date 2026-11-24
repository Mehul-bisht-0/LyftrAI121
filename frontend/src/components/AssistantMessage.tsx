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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
      style={
        accent
          ? {
              color: "hsl(var(--success))",
              borderColor: "hsl(var(--success) / 0.2)",
              background: "hsl(var(--success) / 0.08)",
            }
          : {
              color: "hsl(var(--text-dim))",
              borderColor: "hsl(var(--border-dim))",
              background: "hsl(var(--elevated))",
            }
      }
    >
      <Icon size={10} strokeWidth={2.5} />
      {value}
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
      {/* Relay AI avatar */}
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 mb-1"
        style={{
          background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(239 90% 55%) 100%)",
        }}
        aria-hidden="true"
      >
        R
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        {/* Reply bubble */}
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed border"
          style={{
            background: "hsl(var(--surface))",
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--text))",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {streaming ? (
            /* Plain text while streaming to avoid partial-markdown glitches */
            <span className="whitespace-pre-wrap break-words">
              {content}
              <span className="animate-cursor" aria-hidden="true">▌</span>
            </span>
          ) : (
            /* Full markdown once the stream is done */
            <div className="relay-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata chips row — only when response is complete */}
        {metadata && !streaming && (
          <div className="flex flex-wrap gap-1.5 pl-0.5">
            {/* Source — most prominent */}
            <span
              data-testid="meta-source"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border"
              style={
                isCache
                  ? {
                      color: "hsl(var(--success))",
                      borderColor: "hsl(var(--success) / 0.25)",
                      background: "hsl(var(--success) / 0.1)",
                    }
                  : {
                      color: "hsl(var(--accent-hi))",
                      borderColor: "hsl(var(--accent) / 0.25)",
                      background: "hsl(var(--accent-bg))",
                    }
              }
            >
              {isCache ? <Zap size={10} strokeWidth={2.5} /> : <Radio size={10} strokeWidth={2.5} />}
              {isCache ? "LLM_CACHE" : "LIVE_INFERENCE"}
            </span>

            <MetaChip icon={Layers} value={metadata.model}               testId="meta-model"         />
            <MetaChip icon={Clock}  value={`${metadata.latency_ms} ms`}  testId="meta-latency"       />
            <MetaChip icon={Layers} value={String(metadata.input_tokens)} testId="meta-input-tokens"  />
            <MetaChip icon={Layers} value={String(metadata.output_tokens)} testId="meta-output-tokens" />
            <MetaChip
              icon={Key}
              value={metadata.key_id ?? "cache"}
              testId="metadata-key"
            />
            <MetaChip
              icon={GitBranch}
              value={hasFallback ? `${metadata.fallback_attempts} fallback` : "primary"}
              accent={hasFallback}
              testId="metadata-fallback"
            />
          </div>
        )}
      </div>
    </div>
  );
}
