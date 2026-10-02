import { useRef, useState, type ReactNode } from "react";
import { Brain, Globe, ImagePlus, SendHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesToAttachments } from "@/lib/chat/images";
import { MAX_ATTACHMENTS } from "@/lib/chat/constants";
import type { Attachment } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Composer({
  pending,
  webSearch,
  thinking,
  onWebSearchChange,
  onThinkingChange,
  onSend,
  onStop,
}: {
  pending: boolean;
  webSearch: boolean;
  thinking: boolean;
  onWebSearchChange: (value: boolean) => void;
  onThinkingChange: (value: boolean) => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function addFiles(files: File[]) {
    try {
      const next = await filesToAttachments(files, attachments.length);
      if (next.length === 0) {
        toast.error("Attach an image file - up to four per message.");
        return;
      }
      setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach image");
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
    if (areaRef.current) {
      areaRef.current.style.height = "auto";
    }
  }

  return (
    <div className="cove-measure mx-auto w-full px-4 pb-16 sm:px-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
          dragOver && "shadow-[var(--shadow-border-hover)]",
        )}
      >
        {attachments.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto px-2 pt-2 pb-1">
            {attachments.map((file) => (
              <div key={file.id} className="relative shrink-0">
                <img
                  src={file.dataUrl}
                  alt={file.name}
                  className="chat-image size-16 rounded-md object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-fg text-bg"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((item) => item.id !== file.id))
                  }
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          ref={areaRef}
          value={text}
          placeholder="Message Cove…"
          rows={1}
          className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle"
          onChange={(event) => {
            setText(event.target.value);
            const el = event.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!pending) submit();
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) =>
              file.type.startsWith("image/"),
            );
            if (files.length) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Attach image"
              disabled={attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
            </Button>
            <ModeToggle
              pressed={webSearch}
              label="Search"
              ariaLabel="Web search"
              onPressedChange={onWebSearchChange}
            >
              <Globe />
            </ModeToggle>
            <ModeToggle
              pressed={thinking}
              label="Think"
              ariaLabel="Thinking mode"
              onPressedChange={onThinkingChange}
            >
              <Brain />
            </ModeToggle>
          </div>
          {pending ? (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={onStop}
              aria-label="Stop"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-sm"
              aria-label="Send"
              disabled={!text.trim() && attachments.length === 0}
              onClick={submit}
            >
              <SendHorizontal />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  pressed,
  label,
  ariaLabel,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  label: string;
  ariaLabel: string;
  onPressedChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-[color,background-color,box-shadow] duration-150",
        pressed ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span className="[&_svg]:size-3.5">{children}</span>
      {label}
    </button>
  );
}
