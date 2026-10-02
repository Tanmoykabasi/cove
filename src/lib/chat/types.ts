export type ChatRole = "user" | "assistant" | "system";

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
};

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

/** Token counts reported by the provider for one completion, when available. */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  sources?: SearchHit[];
  attachments?: Attachment[];
  createdAt: number;
  error?: string;
  model?: string;
  /** Set on assistant replies in compare mode; "a" is the left column. */
  lane?: "a" | "b";
  usage?: TokenUsage;
  /** Wall-clock time for the whole reply, in milliseconds. */
  latencyMs?: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type ChatSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  stream: boolean;
  webSearch: boolean;
  thinking: boolean;
  /** Compare mode: every prompt is answered by `model` and `modelB` side by side. */
  compare: boolean;
  modelB: string;
  /** Optional estimated pricing, USD per 1M tokens; 0 disables the cost figure. */
  priceInputPerM: number;
  priceOutputPerM: number;
};

/** `system` follows the OS setting; the others pin an explicit choice. */
export type ThemeMode = "system" | "light" | "dark";
export type MotionPreference = "system" | "reduced" | "full";
export type FontScale = "small" | "medium" | "large" | "xlarge";

/** Accessibility and display preferences - independent of the API connection. */
export type DisplaySettings = {
  theme: ThemeMode;
  fontScale: FontScale;
  motion: MotionPreference;
  highContrast: boolean;
  wideLayout: boolean;
};

export type ApiContentPart =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type ApiMessage = {
  role: ChatRole;
  content: string | ApiContentPart[];
};
