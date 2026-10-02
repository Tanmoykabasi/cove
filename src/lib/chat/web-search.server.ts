import type { SearchHit } from "./types";

export type { SearchHit };

function decodeHtml(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .replace(/<[^>]+>/g, "")
    .replace(new RegExp(amp + "quot;", "g"), '"')
    .replace(new RegExp(amp + "#x27;", "g"), "'")
    .replace(new RegExp(amp + "#39;", "g"), "'")
    .replace(new RegExp(amp + "lt;", "g"), "<")
    .replace(new RegExp(amp + "gt;", "g"), ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(new RegExp(amp + "amp;", "g"), amp)
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapDuckUrl(href: string): string {
  try {
    const amp = String.fromCharCode(38);
    const decoded = href.replace(new RegExp(amp + "amp;", "g"), amp);
    const absolute = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    const parsed = new URL(absolute);
    const target = parsed.searchParams.get("uddg");
    return target || absolute;
  } catch {
    return href;
  }
}

function parseDuckLite(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const tagRe = /<a\b([^>]*class=['"]result-link['"][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(tagRe)) {
    const attrs = match[1] ?? "";
    const href = /href=['"]([^'"]+)['"]/.exec(attrs)?.[1];
    const title = decodeHtml(match[2] ?? "");
    if (!href || !title) continue;
    const url = unwrapDuckUrl(href);
    if (!/^https?:\/\//i.test(url)) continue;
    const after = html.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 1400);
    const snippet = decodeHtml(
      /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i.exec(after)?.[1] ?? "",
    );
    hits.push({ title, url, snippet });
    if (hits.length >= 6) break;
  }
  return hits;
}

async function searchDuckDuckGo(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=wt-wt`;
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  return parseDuckLite(html);
}

async function searchWikipedia(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=4&namespace=0&format=json`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as [string, string[], string[], string[]];
  const titles = json[1] ?? [];
  const snippets = json[2] ?? [];
  const links = json[3] ?? [];
  const hits: SearchHit[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const href = links[i];
    if (!title || !href) continue;
    hits.push({ title, url: href, snippet: snippets[i] || "" });
  }
  return hits;
}

export function lastUserText(messages: { role: string; content: unknown }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content.trim();
    if (Array.isArray(message.content)) {
      const text = message.content
        .map((part) =>
          part && typeof part === "object" && "text" in part && typeof part.text === "string"
            ? part.text
            : "",
        )
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

export async function searchWeb(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 220);
  if (!q) return [];
  const timeout = AbortSignal.timeout(8_000);
  const combined =
    signal && "any" in AbortSignal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const duck = await searchDuckDuckGo(q, combined);
    if (duck.length) return duck;
  } catch {
    /* fall through */
  }
  try {
    return await searchWikipedia(q, combined);
  } catch {
    return [];
  }
}

export function attachSearchContext<T extends { role: string; content: unknown }>(
  messages: T[],
  hits: SearchHit[],
): T[] {
  if (messages.length === 0) return messages;
  const body = hits.length
    ? hits
        .map((hit, i) => `${i + 1}. ${hit.title}\n   ${hit.url}\n   ${hit.snippet}`)
        .join("\n\n")
    : "(no results)";
  const note = {
    role: "system" as const,
    content: hits.length
      ? `Live web search results retrieved just now for the user's latest question. Use them to answer. Cite titles and URLs. Do not claim you cannot browse the web - these results are your live sources.\n\n${body}`
      : "Live web search ran but returned no results. Answer from what you know and say that live sources could not be retrieved.",
  };
  // Anchor to the last *user* turn, not merely the last message - on edit and
  // retry flows the transcript does not always end with the user.
  let anchor = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) anchor = messages.length - 1;

  return [...messages.slice(0, anchor), note as T, ...messages.slice(anchor)];
}
