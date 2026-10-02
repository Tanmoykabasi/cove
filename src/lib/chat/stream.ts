import { splitThinkTags } from "./messages";
import type { ApiMessage, SearchHit, TokenUsage } from "./types";

export type ChatRequest = {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ApiMessage[];
  temperature: number;
  maxTokens: number;
  stream: boolean;
  webSearch?: boolean;
  thinking?: boolean;
};

type ApiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

function normalizeUsage(usage?: ApiUsage): TokenUsage | undefined {
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  if (!promptTokens && !completionTokens && !totalTokens) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

type ChatHandlers = {
  onDelta: (text: string) => void;
  onReasoning?: (text: string) => void;
  onModel?: (model: string) => void;
  onSources?: (sources: SearchHit[]) => void;
  onUsage?: (usage: TokenUsage) => void;
};

type ChatResult = {
  text: string;
  reasoning: string;
  model?: string;
  sources: SearchHit[];
  usage?: TokenUsage;
};

export async function sendChat(
  request: ChatRequest,
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<ChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      /* keep fallback */
    }
    throw new Error(message);
  }

  if (contentType.includes("text/event-stream") && res.body) {
    return readSse(res.body, handlers);
  }

  const json = (await res.json()) as {
    error?: string;
    model?: string;
    usage?: ApiUsage;
    cove_sources?: SearchHit[];
    choices?: {
      message?: {
        content?: string;
        reasoning_content?: string;
        reasoning?: string;
      };
    }[];
  };
  if (json.error) throw new Error(json.error);
  const raw = json.choices?.[0]?.message?.content ?? "";
  const split = splitThinkTags(raw);
  const reasoning =
    json.choices?.[0]?.message?.reasoning_content ||
    json.choices?.[0]?.message?.reasoning ||
    split.reasoning;
  const text = split.content || (reasoning ? "" : raw);
  const sources = Array.isArray(json.cove_sources) ? json.cove_sources : [];
  const usage = normalizeUsage(json.usage);
  if (json.model) handlers.onModel?.(json.model);
  if (sources.length) handlers.onSources?.(sources);
  if (reasoning) handlers.onReasoning?.(reasoning);
  if (usage) handlers.onUsage?.(usage);
  if (text) handlers.onDelta(text);
  return { text, reasoning, model: json.model, sources, usage };
}

function reasoningFromChunk(json: {
  choices?: {
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
    };
    message?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
    };
  }[];
}): string {
  const delta = json.choices?.[0]?.delta;
  const message = json.choices?.[0]?.message;
  return (
    delta?.reasoning_content ||
    delta?.reasoning ||
    message?.reasoning_content ||
    message?.reasoning ||
    ""
  );
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  handlers: ChatHandlers,
): Promise<ChatResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let fieldReasoning = "";
  let model: string | undefined;
  let sources: SearchHit[] = [];
  let usage: TokenUsage | undefined;

  const emitReasoning = (tagReasoning: string) => {
    const combined = fieldReasoning.includes(tagReasoning)
      ? fieldReasoning
      : [fieldReasoning, tagReasoning].filter(Boolean).join("\n\n");
    if (combined) handlers.onReasoning?.(combined);
    return combined;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          model?: string;
          usage?: ApiUsage;
          cove_sources?: SearchHit[];
          choices?: {
            delta?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
            };
            message?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
            };
          }[];
        };
        // With stream_options.include_usage the provider sends a final chunk
        // carrying usage (and empty choices) - capture it whenever it appears.
        const chunkUsage = normalizeUsage(json.usage);
        if (chunkUsage) {
          usage = chunkUsage;
          handlers.onUsage?.(chunkUsage);
        }
        if (Array.isArray(json.cove_sources) && json.cove_sources.length) {
          sources = json.cove_sources;
          handlers.onSources?.(sources);
        }
        if (json.model && json.model !== model) {
          model = json.model;
          handlers.onModel?.(model);
        }
        const think = reasoningFromChunk(json);
        if (think) {
          fieldReasoning += think;
          emitReasoning(splitThinkTags(text).reasoning);
        }
        const delta =
          json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
        if (typeof delta === "string" && delta) {
          text += delta;
          const split = splitThinkTags(text);
          emitReasoning(split.reasoning);
          handlers.onDelta(split.content);
        }
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
  const split = splitThinkTags(text);
  const reasoning = emitReasoning(split.reasoning);
  return { text: split.content || text, reasoning, model, sources, usage };
}
