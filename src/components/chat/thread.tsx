import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy, Globe, Pencil } from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChatMessage, SearchHit } from "@/lib/chat/types";
import { formatLatency, formatTokens } from "@/components/chat/usage-chip";

function CopyButton({ text, compact }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy"}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg",
        compact ? "h-11 gap-1.5 px-3 text-xs font-medium" : "size-8",
      )}
      onClick={async (event) => {
        event.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {compact ? (copied ? "Copied" : "Copy") : null}
    </button>
  );
}

function ImageGrid({
  urls,
  onOpen,
}: {
  urls: { id: string; dataUrl: string; name: string }[];
  onOpen: (url: string) => void;
}) {
  return (
    <div className={cn("grid gap-2", urls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {urls.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onOpen(file.dataUrl)}
          className="overflow-hidden rounded-lg bg-surface-2"
        >
          <img
            src={file.dataUrl}
            alt={file.name}
            className="chat-image max-h-64 w-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}

function UserMessage({
  message,
  selected,
  onSelect,
  onEdit,
  onOpenImage,
}: {
  message: ChatMessage;
  selected: boolean;
  onSelect: () => void;
  onEdit: (content: string) => void;
  onOpenImage: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);

  useEffect(() => {
    setDraft(message.content);
  }, [message.content]);

  useEffect(() => {
    if (!editing) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // A textarea created and focused in the same tick puts the caret at
    // position 0; editing a message should start you at the end of it, ready
    // to append - not rewind you to the first word.
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [editing]);

  const hasText = Boolean(message.content.trim());
  const canSave = draft.trim().length > 0 || (message.attachments?.length ?? 0) > 0;

  function save() {
    if (!canSave) return;
    const next = draft.trim();
    setEditing(false);
    if (next === message.content.trim()) return;
    onEdit(next);
  }

  return (
    <div className="ml-auto w-fit max-w-[min(100%,40rem)]">
      {message.attachments && message.attachments.length > 0 ? (
        <div className="mb-2 ml-auto max-w-xs">
          <ImageGrid
            urls={message.attachments}
            onOpen={(url) => {
              // First tap selects the message, a second opens the lightbox.
              if (!selected) onSelect();
              else onOpenImage(url);
            }}
          />
        </div>
      ) : null}
      {editing ? (
        <div className="rounded-xl rounded-br-sm bg-surface-2 p-2 shadow-[var(--shadow-border-hover)]">
          <textarea
            ref={editorRef}
            value={draft}
            rows={2}
            className="max-h-52 min-h-16 w-full min-w-56 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-fg outline-none sm:min-w-72"
            onChange={(event) => {
              setDraft(event.target.value);
              const el = event.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft(message.content);
                setEditing(false);
              }
            }}
          />
          <div className="flex justify-end gap-2 px-1 pb-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(message.content);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!canSave} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : hasText ? (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "w-full rounded-xl rounded-br-sm bg-surface-2 px-4 py-3 text-left text-sm leading-relaxed whitespace-pre-wrap text-fg shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
            selected && "shadow-[var(--shadow-border-hover)]",
          )}
        >
          {message.content}
        </button>
      ) : null}
      {selected && !editing ? (
        <div className="mt-1 flex justify-end gap-1">
          <CopyButton text={message.content} compact />
          <button
            type="button"
            aria-label="Edit message"
            className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            onClick={(event) => {
              event.stopPropagation();
              setDraft(message.content);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** One assistant reply: reasoning, content, sources, error and the usage line. */
function AssistantMessage({
  message,
  pending,
  webSearch,
  thinking,
}: {
  message: ChatMessage;
  pending: boolean;
  webSearch: boolean;
  thinking: boolean;
}) {
  // `684↑ 10↓ · 2.4s` - tokens in, tokens out, then how long the reply took.
  const stats = [
    message.usage
      ? `${formatTokens(message.usage.promptTokens)}↑ ${formatTokens(message.usage.completionTokens)}↓`
      : null,
    message.latencyMs != null ? formatLatency(message.latencyMs) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full">
      {message.error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message.error}</p>
      ) : (
        <>
          {message.reasoning ? (
            <ReasoningBlock text={message.reasoning} live={pending} />
          ) : pending && !message.content ? (
            <StatusLine
              searching={webSearch}
              thinking={thinking}
              sourceCount={message.sources?.length ?? 0}
            />
          ) : null}
          {message.content ? <Markdown text={message.content} /> : null}
          {message.sources && message.sources.length > 0 ? (
            <SourcesList sources={message.sources} />
          ) : null}
        </>
      )}
      {message.content && !message.error ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <CopyButton text={message.content} />
          {message.model ? <span className="text-xs text-subtle">{message.model}</span> : null}
          {stats ? (
            <span className="font-mono text-xs tabular-nums text-subtle">{stats}</span>
          ) : null}
        </div>
      ) : message.error && stats ? (
        // Keep the timing visible on a stopped or failed turn - that is exactly
        // when knowing how long the provider took matters.
        <p className="mt-2 font-mono text-xs tabular-nums text-subtle">{stats}</p>
      ) : null}
    </div>
  );
}

/**
 * Consecutive assistant replies form one turn - in compare mode that is the
 * lane "a"/"b" pair, rendered side by side from md-width up and stacked below.
 */
type RenderGroup =
  | { kind: "user"; message: ChatMessage }
  | { kind: "assistant"; messages: ChatMessage[] };

function groupMessages(messages: ChatMessage[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      groups.push({ kind: "user", message });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.kind === "assistant") last.messages.push(message);
    else groups.push({ kind: "assistant", messages: [message] });
  }
  return groups;
}

export function Thread({
  messages,
  pending,
  webSearch,
  thinking,
  onEditUser,
}: {
  messages: ChatMessage[];
  pending: boolean;
  webSearch: boolean;
  thinking: boolean;
  onEditUser: (messageId: string, content: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Only auto-scroll while the reader is already at the bottom, otherwise a
  // streaming reply would yank the viewport down on every token.
  const stickToBottom = useRef(true);

  const groups = groupMessages(messages);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (!selectedId) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-user-msg]")) return;
      setSelectedId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedId]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-3xl tracking-tight text-balance text-fg sm:text-4xl">
          Ask, attach, send.
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-pretty text-muted">
          Pick a model from the header, drop in an image if you like, and talk. Your endpoint and
          key live in Settings - they never leave this browser.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const el = event.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="cove-measure mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
        {groups.map((group, groupIndex) => {
          const isLastGroup = groupIndex === groups.length - 1;
          if (group.kind === "user") {
            const message = group.message;
            return (
              <article key={message.id} data-user-msg="" className="flex justify-end">
                <UserMessage
                  message={message}
                  selected={selectedId === message.id}
                  onSelect={() => setSelectedId((id) => (id === message.id ? null : message.id))}
                  onEdit={(content) => {
                    setSelectedId(null);
                    onEditUser(message.id, content);
                  }}
                  onOpenImage={setLightbox}
                />
              </article>
            );
          }

          const lanes = group.messages;
          const paired = lanes.length > 1;
          return (
            <article key={lanes[0]?.id ?? groupIndex} className="flex justify-start">
              {paired ? (
                <div
                  className={cn(
                    "grid w-full gap-4",
                    paired && "md:grid-cols-2",
                    paired ? "max-w-full" : "max-w-[min(100%,40rem)]",
                  )}
                >
                  {lanes.map((message) => (
                    <div
                      key={message.id}
                      className="min-w-0 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
                    >
                      <p className="mb-2 flex items-center gap-1.5 font-mono text-xs text-subtle">
                        <span
                          className={cn(
                            "flex size-4.5 items-center justify-center rounded-full text-[0.6rem] font-semibold",
                            message.lane === "b"
                              ? "bg-accent/15 text-accent"
                              : "bg-surface-2 text-muted",
                          )}
                          aria-hidden
                        >
                          {message.lane === "b" ? "B" : "A"}
                        </span>
                        <span className="truncate">{message.model ?? "model"}</span>
                      </p>
                      <AssistantMessage
                        message={message}
                        pending={isLastGroup && pending}
                        webSearch={webSearch}
                        thinking={thinking}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full max-w-[min(100%,40rem)]">
                  {lanes.map((message) => (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      pending={isLastGroup && pending}
                      webSearch={webSearch}
                      thinking={thinking}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent>
          <DialogTitle>Attached image</DialogTitle>
          {lightbox ? (
            <img
              src={lightbox}
              alt="Attachment"
              className="chat-image max-h-[80vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusLine({
  searching,
  thinking,
  sourceCount,
}: {
  searching: boolean;
  thinking: boolean;
  sourceCount: number;
}) {
  const label = sourceCount
    ? `Using ${sourceCount} sources`
    : searching
      ? "Searching the web"
      : thinking
        ? "Thinking"
        : "Waiting for reply";
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-muted" aria-label={label}>
      <span className="flex items-center gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-muted" />
        <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:120ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:240ms]" />
      </span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Sources stay collapsed behind a tap: a reply can cite six pages and rendering
 * them inline pushes the actual answer off screen. Open, they list top-to-bottom
 * in the order the search returned them.
 */
function SourcesList({ sources }: { sources: SearchHit[] }) {
  const [open, setOpen] = useState(false);
  const count = sources.length;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="cove-sources-list"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        <Globe className="size-3.5" />
        {count} {count === 1 ? "source" : "sources"}
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
        />
      </button>

      {open ? (
        <ol id="cove-sources-list" className="mt-2 space-y-2 border-l border-border pl-3">
          {sources.map((source, index) => (
            <li key={source.url} className="text-xs">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex gap-1.5 text-fg transition-colors hover:text-accent"
              >
                <span className="tabular-nums text-subtle">{index + 1}.</span>
                <span className="min-w-0">
                  <span className="block leading-snug">{source.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[0.7rem] text-subtle">
                    {hostOf(source.url)}
                  </span>
                </span>
              </a>
              {source.snippet ? (
                <p className="mt-1 line-clamp-2 pl-4 leading-relaxed text-subtle">
                  {source.snippet}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Readable origin for a result URL; falls back to the raw value. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ReasoningBlock({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(live);
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
        />
        {live ? "Thinking" : "Thoughts"}
      </button>
      {open ? (
        <p className="mt-1 max-h-48 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-subtle">
          {text}
        </p>
      ) : null}
    </div>
  );
}
