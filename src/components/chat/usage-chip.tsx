import { useRef, useState } from "react";
import { Coins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TokenUsage } from "@/lib/chat/types";

/** Compact 12.4k / 1.5M style token count. */
export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

/** Reply time: sub-second stays in ms, anything longer reads as seconds. */
export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Whether the primary pointer can hover at all - false on touch-only devices. */
function canHover(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * Per-conversation usage readout: total tokens in the header chip, full
 * prompt/completion breakdown (plus estimated cost when pricing is set) in the
 * panel.
 *
 * Opens on click AND on hover. A tooltip alone would be unreachable on a phone,
 * where a tap is the only gesture available and hover never fires.
 */
export function UsageChip({
  totals,
  priceInputPerM,
  priceOutputPerM,
}: {
  totals: TokenUsage;
  priceInputPerM: number;
  priceOutputPerM: number;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (totals.totalTokens <= 0) return null;

  const cost =
    (totals.promptTokens / 1_000_000) * priceInputPerM +
    (totals.completionTokens / 1_000_000) * priceOutputPerM;
  const showCost = (priceInputPerM > 0 || priceOutputPerM > 0) && cost > 0;

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  // A short grace period so the pointer can travel from the chip to the panel
  // (which is portalled elsewhere in the DOM) without it closing underneath.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Usage for this conversation: ${totals.totalTokens} tokens. Show details`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 font-mono text-xs tabular-nums text-muted shadow-[var(--shadow-border)] transition-colors hover:text-fg"
          onPointerEnter={() => {
            if (!canHover()) return;
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={() => {
            if (!canHover()) return;
            scheduleClose();
          }}
        >
          <Coins className="size-3.5" aria-hidden />
          {formatTokens(totals.totalTokens)} tok
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <p className="whitespace-nowrap">Prompt {formatTokens(totals.promptTokens)} tok</p>
        <p className="whitespace-nowrap">Completion {formatTokens(totals.completionTokens)} tok</p>
        {showCost ? (
          <p className="whitespace-nowrap">Estimated cost ${cost.toFixed(cost < 1 ? 4 : 2)}</p>
        ) : (
          <p className="whitespace-nowrap text-subtle">
            Set pricing in Settings for a cost estimate
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
