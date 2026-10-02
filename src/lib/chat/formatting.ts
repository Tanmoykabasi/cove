/**
 * The formatting contract.
 *
 * This file is the single source of truth for the markup the app renders:
 * `src/components/chat/markdown.tsx` implements exactly these forms, and
 * `FORMATTING_GUIDE` is injected into the system prompt so every model - across
 * providers and model families - emits syntax the renderer actually supports.
 * Adding a form here without implementing it in the renderer, or vice versa,
 * makes the two drift and is the failure mode this file exists to prevent.
 */
export type FormattingRule = {
  /** Human name, used as the label in the guide. */
  name: string;
  /** Canonical syntax the renderer accepts. */
  syntax: string;
  /** Minimal example shown to the model. */
  example: string;
};

export const FORMATTING_RULES: readonly FormattingRule[] = [
  { name: "Bold", syntax: "**text**", example: "**important**" },
  { name: "Italic", syntax: "*text*", example: "*emphasis*" },
  { name: "Bold italic", syntax: "***text***", example: "***both***" },
  { name: "Strikethrough", syntax: "~~text~~", example: "~~removed~~" },
  { name: "Inline code", syntax: "`code`", example: "`npm run dev`" },
  {
    name: "Code block",
    syntax: "``` followed by an optional language tag",
    example: "```ts\nconst answer = 42;\n```",
  },
  { name: "Headings", syntax: "# to ###### at the start of a line", example: "## Results" },
  { name: "Bulleted list", syntax: "- item", example: "- first point" },
  { name: "Numbered list", syntax: "1. item", example: "1. first step" },
  { name: "Nested list", syntax: "indent a nested item by two spaces", example: "  - nested" },
  { name: "Task list", syntax: "- [ ] open / - [x] done", example: "- [x] shipped" },
  { name: "Blockquote", syntax: "> text", example: "> quoted passage" },
  {
    name: "Table",
    syntax: "pipe-separated rows with a --- separator row",
    example: "| Model | Speed |\n| --- | --- |\n| Step | fast |",
  },
  { name: "Divider", syntax: "--- on its own line", example: "---" },
  { name: "Link", syntax: "[label](https://…)", example: "[docs](https://example.com)" },
] as const;

/** Injected into the default system prompt; keep in sync via FORMATTING_RULES. */
export const FORMATTING_GUIDE = [
  "Formatting - this app renders a fixed subset of Markdown. Use these forms:",
  ...FORMATTING_RULES.map((rule) => `- ${rule.name}: ${rule.syntax}`),
  "- Do not emit raw HTML tags; they are shown as literal text.",
  "- Do not use syntax outside this list, and do not wrap a whole reply in a code block.",
].join("\n");
