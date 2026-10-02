import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/chat/types";

function relativeTime(ts: number): string {
  const delta = Date.now() - ts;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onClose,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-5 pb-4">
        <div className="min-w-0">
          <p className="font-display text-lg tracking-tight text-fg">Cove</p>
          <p className="text-xs text-subtle">Studio chat</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="icon-sm" variant="secondary" onClick={onNew} aria-label="New chat">
            <Plus />
          </Button>
          {onClose ? (
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close conversations">
              <X />
            </Button>
          ) : null}
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-subtle">No conversations yet.</p>
        ) : (
          conversations.map((chat) => {
            const active = chat.id === activeId;
            return (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1",
                  active ? "bg-surface-2" : "hover:bg-surface-2/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(chat.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{chat.title}</span>
                    <span className="block text-xs tabular-nums text-subtle">
                      {relativeTime(chat.updatedAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${chat.title}`}
                  onClick={() => onDelete(chat.id)}
                  className="size-8 shrink-0 rounded-md text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bg hover:text-danger focus-visible:opacity-100"
                >
                  <Trash2 className="mx-auto size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
