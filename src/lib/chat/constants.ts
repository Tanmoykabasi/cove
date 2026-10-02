import type { DisplaySettings, FontScale, MotionPreference, ThemeMode } from "./types";

export const APP_NAME = "Cove";

export const DEFAULT_TEMPERATURE = 0.7;
/**
 * Reasoning models on this gateway (step-3.7-flash, sensenova-6.8-flash-lite)
 * bill their chain-of-thought against the same budget, so 2048 was frequently
 * consumed by reasoning alone and the reply came back with empty `content`.
 */
export const DEFAULT_MAX_TOKENS = 4096;
/**
 * Prepended as the first `system` message by `toApiMessages` whenever it is
 * non-empty. Editable per user in Settings, and restored by "Restore defaults".
 *
 * Deliberately one line: a long system prompt is re-sent on every single turn,
 * so it inflates the prompt-token count (and the bill) for the whole
 * conversation. The shorter it is, the more of the budget goes to the actual
 * conversation.
 */
export const DEFAULT_SYSTEM_PROMPT = "You are Cove, a general-purpose assistant inside a chat app.";

const NON_CHAT_ID = /(embed|rerank|moderation|whisper)/i;
const NON_CHAT_ENDPOINT = /(image|tts|asr|realtime|speech)/i;

/**
 * `/v1/models` also advertises embeddings, image editing and audio endpoints,
 * which 404 or hang when hit through /chat/completions. Keep them out of the
 * picker. Note `stepaudio-2.5-chat` is a real chat model and is kept - only the
 * dedicated asr/tts/realtime variants are dropped.
 */
export function isChatModel(id: string, endpointTypes?: string[]): boolean {
  if (NON_CHAT_ID.test(id) || NON_CHAT_ENDPOINT.test(id)) return false;
  if (endpointTypes && endpointTypes.length > 0) {
    const chat = endpointTypes.some(
      (type) => type === "openai" || type === "anthropic" || type === "gemini",
    );
    if (!chat) return false;
  }
  return true;
}

/** Root font size per text-size option; everything else is rem-based. */
export const FONT_SCALE_PX: Record<FontScale, number> = {
  small: 14,
  medium: 16,
  large: 18,
  xlarge: 20,
};

export const FONT_SCALE_LABELS: { value: FontScale; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

export const THEME_LABELS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const MOTION_LABELS: { value: MotionPreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "reduced", label: "Reduced" },
  { value: "full", label: "Full" },
];

/** Browser chrome colours per resolved theme (`<meta name="theme-color">`). */
export const THEME_COLOR: Record<"light" | "dark", string> = {
  dark: "#0b0b0c",
  light: "#fbfbfd",
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: "system",
  fontScale: "medium",
  motion: "system",
  highContrast: false,
  wideLayout: false,
};

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_EDGE = 1280;
export const HISTORY_LIMIT = 24;
