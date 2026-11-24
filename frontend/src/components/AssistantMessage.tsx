import type { ReplyMetadata } from "../types";

interface Props {
  content: string;
  metadata: ReplyMetadata;
}

export function AssistantMessage({ content, metadata }: Props) {
  const isCache = metadata.resolution_source === "LLM_CACHE";

  return (
    <div
      data-testid="assistant-message"
      className="flex flex-col gap-2 max-w-[80%]"
    >
      {/* Reply bubble */}
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {content}
      </div>

      {/* Metadata panel */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-gray-400">
        <span
          data-testid="metadata-source"
          className={`font-medium ${isCache ? "text-green-500" : "text-blue-500"}`}
        >
          {isCache ? "⚡ cache" : "🤖 live"}
        </span>

        <span data-testid="metadata-model" title="Model">
          {metadata.model.split("/").pop()}
        </span>

        <span data-testid="metadata-latency">
          {metadata.latency_ms}ms
        </span>

        <span data-testid="metadata-tokens">
          {metadata.input_tokens}↑ {metadata.output_tokens}↓ tok
        </span>

        <span data-testid="metadata-key">
          {metadata.key_id ?? "cache"}
        </span>

        <span data-testid="metadata-fallback">
          {metadata.fallback_attempts > 0
            ? `↩ ${metadata.fallback_attempts} fallback`
            : "primary"}
        </span>
      </div>
    </div>
  );
}
