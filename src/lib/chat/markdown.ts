/**
 * Pure parsing layer for the formatting contract in `./formatting.ts`.
 *
 * Deliberately free of React (and of any `@/` import) so it can be unit-tested
 * directly under `node --experimental-strip-types` - see `markdown.test.ts`,
 * which fails if a rule is added to FORMATTING_RULES without the parser
 * supporting it.
 */

export const CODE_INLINE_CLASS =
  "rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-fg";
export const LINK_CLASS = "underline decoration-border underline-offset-2 hover:text-fg";

export type ListItem = { text: string; task: boolean | null; children: ListItem[] };

export type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "heading"; level: number; text: string }
  | { type: "rule" }
  | { type: "quote"; lines: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "paragraph"; lines: string[] };

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const QUOTE_LINE = /^\s*>\s?/;
const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const RULE = /^\s*([-*_])\s*(?:\1\s*){2,}$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function escapeHtml(value: string): string {
  return Array.from(value, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    if (ch === "'") return "&" + "#39;";
    return ch;
  }).join("");
}

/** Only http(s) targets are linkified; anything else stays literal text. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/"/g, "%22");
}

const TOKEN = "\u0000";

/**
 * Formatting for the inside of a block.
 *
 * Everything is escaped first and only then decorated. Code spans and links are
 * stashed as placeholders in between, so their contents are never reformatted -
 * a `**` inside backticks has to stay literal.
 */
export function inlineFormat(value: string): string {
  const stash: string[] = [];
  const keep = (html: string) => {
    stash.push(html);
    return `${TOKEN}${stash.length - 1}${TOKEN}`;
  };

  let out = escapeHtml(value);

  // 1. Inline code first, so its contents are never treated as markup.
  out = out.replace(/`([^`]+)`/g, (_match, code: string) =>
    keep(`<code class="${CODE_INLINE_CLASS}">${code}</code>`),
  );

  // 2. Explicit links, then bare URLs.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeHref(url);
    if (!href) return match;
    return keep(
      `<a class="${LINK_CLASS}" href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`,
    );
  });
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+)/g, (_match, prefix: string, url: string) => {
    const href = safeHref(url);
    if (!href) return `${prefix}${url}`;
    return `${prefix}${keep(
      `<a class="${LINK_CLASS}" href="${href}" target="_blank" rel="noreferrer noopener">${url}</a>`,
    )}`;
  });

  // 3. Emphasis, longest delimiters first so *** is not eaten by **.
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-fg">$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong class="font-semibold text-fg">$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em class="italic">$2</em>');
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em class="italic">$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del class="opacity-70">$1</del>');

  // 4. Put the protected spans back.
  return out.replace(
    new RegExp(`${TOKEN}(\\d+)${TOKEN}`, "g"),
    (_match, index: string) => stash[Number(index)] ?? "",
  );
}

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    RULE.test(line) ||
    HEADING.test(line) ||
    QUOTE_LINE.test(line) ||
    LIST_ITEM.test(line)
  );
}

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((cell) => cell.trim());
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index] ?? "";
  const separator = lines[index + 1] ?? "";
  if (!header.includes("|")) return false;
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(separator) && separator.includes("-");
}

/** Turns flat list lines into a tree using indentation depth. */
export function buildList(lines: string[]): { ordered: boolean; items: ListItem[] } {
  const ordered = /^\s*\d+[.)]\s+/.test(lines[0] ?? "");
  const items: ListItem[] = [];
  const stack: { indent: number; item: ListItem }[] = [];

  for (const line of lines) {
    const match = LIST_ITEM.exec(line);
    if (!match) continue;
    const indent = (match[1] ?? "").length;
    let text = match[3] ?? "";
    let task: boolean | null = null;
    const checkbox = /^\[([ xX])\]\s+(.*)$/.exec(text);
    if (checkbox) {
      task = checkbox[1]?.toLowerCase() === "x";
      text = checkbox[2] ?? "";
    }

    const item: ListItem = { text, task, children: [] };
    while (stack.length > 0 && indent <= (stack[stack.length - 1]?.indent ?? 0)) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.item.children.push(item);
    else items.push(item);
    stack.push({ indent, item });
  }

  return { ordered, items };
}

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? "```";
      const lang = fence[2] ?? "";
      const body: string[] = [];
      i++;
      const closing = new RegExp(`^\\s*${marker}\\s*$`);
      while (i < lines.length && !closing.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ type: "code", lang, code: body.join("\n") });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: (heading[1] ?? "#").length,
        text: heading[2] ?? "",
      });
      i++;
      continue;
    }

    if (QUOTE_LINE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && QUOTE_LINE.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(QUOTE_LINE, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
        rows.push(splitRow(lines[i] ?? ""));
        i++;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i] ?? "")) {
        listLines.push(lines[i] ?? "");
        i++;
      }
      blocks.push({ type: "list", ...buildList(listLines) });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !startsBlock(lines[i] ?? "")) {
      paragraph.push(lines[i] ?? "");
      i++;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}
