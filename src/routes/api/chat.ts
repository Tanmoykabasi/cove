import { createFileRoute } from "@tanstack/react-router";
import { parseProviderError } from "@/lib/chat/messages";
import { resolveConnection } from "@/lib/chat/secrets.server";
import {
  attachSearchContext,
  lastUserText,
  searchWeb,
  type SearchHit,
} from "@/lib/chat/web-search.server";
import type { ApiMessage } from "@/lib/chat/types";

type ChatBody = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messages?: ApiMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  webSearch?: boolean;
  thinking?: boolean;
};

/**
 * The gateway load-balances across upstream channels and drops roughly one
 * request in three with a transient 5xx, so every request gets one retry.
 * 4xx (bad key, unknown model, quota) is never retried - it will fail again.
 */
/** Time-to-first-byte budget. DeepSeek-V4.1-Flash measures ~47s on this gateway. */
const BASE_WAIT_MS = 90_000;
const HEAVY_WAIT_MS = 150_000;

type UpstreamResult =
  | { kind: "ok"; response: Response }
  | { kind: "http"; status: number; body: string }
  | { kind: "network"; name: string; message: string };

async function requestUpstream(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>,
  waitMs: number,
  requestSignal: AbortSignal,
): Promise<UpstreamResult> {
  try {
    const timeout = AbortSignal.timeout(waitMs);
    const signal =
      "any" in AbortSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (response.ok) return { kind: "ok", response };
    // Drain the error body so the socket is reusable and we can report it.
    const body = await response.text();
    return { kind: "http", status: response.status, body };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : "Could not reach the API";
    return { kind: "network", name, message };
  }
}

function prefixSse(event: unknown, upstream: ReadableStream<Uint8Array>) {
  const head = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(head);
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
      } finally {
        controller.close();
      }
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const model = body.model?.trim();
        if (!model) {
          return Response.json({ error: "Choose a model" }, { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return Response.json({ error: "Messages are required" }, { status: 400 });
        }

        let apiKey: string;
        let baseUrl: string;
        try {
          const resolved = resolveConnection(body.apiKey, body.baseUrl);
          apiKey = resolved.apiKey;
          baseUrl = resolved.baseUrl;
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Invalid connection" },
            { status: 400 },
          );
        }

        let messages = body.messages;
        let sources: SearchHit[] = [];
        if (body.webSearch) {
          const query = lastUserText(messages);
          if (query) {
            sources = await searchWeb(query, request.signal);
            messages = attachSearchContext(messages, sources);
          }
        }

        const stream = body.stream !== false;
        const payload: Record<string, unknown> = {
          model,
          messages,
          stream,
        };
        if (stream) {
          // Ask for a final usage chunk so the client can track token counts.
          // Strict providers may reject the field - see the 400 retry below.
          payload.stream_options = { include_usage: true };
        }
        if (typeof body.temperature === "number") payload.temperature = body.temperature;
        if (typeof body.maxTokens === "number") payload.max_tokens = body.maxTokens;
        if (body.thinking) {
          payload.enable_thinking = true;
          payload.thinking = { type: "enabled" };
        }

        const waitMs = body.webSearch || body.thinking ? HEAVY_WAIT_MS : BASE_WAIT_MS;
        const url = `${baseUrl}/chat/completions`;

        // No retries: one user action is one upstream request, and a failed
        // turn reports its error instead of silently re-billing the provider.
        const result = await requestUpstream(url, apiKey, payload, waitMs, request.signal);

        if (result.kind === "network") {
          if (result.name === "TimeoutError" || result.name === "AbortError") {
            return Response.json(
              {
                error:
                  "The model did not respond in time. Try again, or pick another model in Settings.",
              },
              { status: 504 },
            );
          }
          return Response.json({ error: result.message }, { status: 502 });
        }

        if (result.kind === "http") {
          return Response.json(
            { error: parseProviderError(result.body, result.status) },
            { status: result.status },
          );
        }

        const upstream = result.response;

        if (stream && upstream.body) {
          const bodyStream =
            sources.length > 0
              ? prefixSse({ cove_sources: sources }, upstream.body)
              : upstream.body;
          return new Response(bodyStream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
            },
          });
        }

        const json = (await upstream.json()) as Record<string, unknown>;
        if (sources.length) json.cove_sources = sources;
        return Response.json(json);
      },
    },
  },
});
