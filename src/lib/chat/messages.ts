import { HISTORY_LIMIT } from "./constants";
import type { ApiMessage, ChatMessage } from "./types";

export function toApiMessages(
  messages: ChatMessage[],
  systemPrompt: string,
): ApiMessage[] {
  const out: ApiMessage[] = [];
  const prompt = systemPrompt.trim();
  if (prompt) out.push({ role: "system", content: prompt });

  const sliced = messages.slice(-HISTORY_LIMIT);
  for (const message of sliced) {
    if (message.role === "assistant" && (message.error || !message.content.trim())) {
      continue;
    }
    const attachments = message.attachments ?? [];
    if (message.role === "user" && attachments.length > 0) {
      const parts: ApiMessage["content"] = [];
      const text = message.content.trim() || "Please look at the attached image(s).";
      parts.push({ type: "text", text });
      for (const file of attachments) {
        parts.push({ type: "image_url", image_url: { url: file.dataUrl } });
      }
      out.push({ role: "user", content: parts });
    } else {
      out.push({ role: message.role, content: message.content });
    }
  }
  return out;
}

export function titleFromPrompt(text: string, hasImages: boolean): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned.slice(0, 42) + (cleaned.length > 42 ? "…" : "");
  if (hasImages) return "Image message";
  return "New chat";
}

export function splitThinkTags(text: string): { reasoning: string; content: string } {
  const parts: string[] = [];
  let visible = text.replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, (_, inner: string) => {
    if (inner.trim()) parts.push(inner.trim());
    return "";
  });
  const unclosed = visible.match(/<think(?:ing)?>([\s\S]*)$/i);
  if (unclosed) {
    if (unclosed[1]?.trim()) parts.push(unclosed[1].trim());
    visible = visible.slice(0, unclosed.index);
  }
  return { reasoning: parts.join("\n\n"), content: visible };
}

/**
 * Some upstream channels answer HTTP 200 but put their failure in the message
 * body - e.g. glm-4.5-air replies with "余额不足或无可用资源包,请充值。" (insufficient
 * balance, top up). Without this check that text is rendered to the user as if
 * the model had said it.
 */
const SOFT_ERROR_PATTERNS = [
  /余额不足/,
  /无可用资源包/,
  /请充值/,
  /可用渠道不存在/,
  /insufficient (balance|quota|credit)/i,
  /no available channel/i,
  /quota exceeded/i,
  /out of (balance|credit)/i,
];

export function looksLikeProviderError(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return SOFT_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function parseProviderError(raw: string, status: number): string {
  try {
    const json = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const nested = json.error;
    if (typeof nested === "string" && nested.trim()) return nested;
    if (nested && typeof nested === "object" && nested.message) {
      let msg = nested.message;
      try {
        const inner = JSON.parse(msg) as { error?: { message?: string } };
        if (inner.error?.message) msg = inner.error.message;
      } catch {
        /* keep outer message */
      }
      if (/multimodal/i.test(msg)) {
        return "This model does not accept images. Send text only, or switch to a vision-capable model.";
      }
      return msg;
    }
    if (typeof json.message === "string" && json.message.trim()) return json.message;
  } catch {
    /* fall through */
  }
  const clipped = raw.replace(/\s+/g, " ").trim();
  if (clipped) return clipped.slice(0, 280);
  return `Request failed (${status})`;
}
