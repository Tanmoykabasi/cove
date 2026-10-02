import { useRef, type KeyboardEvent } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Segmented control built on Radix RadioGroup, so roving focus and the radio
 * semantics come for free - a row of plain buttons would announce as unrelated
 * toggles to a screen reader.
 *
 * Arrow keys are handled here rather than left to Radix: its internal
 * "was this focus caused by an arrow key" flag races with the focus event, so
 * the same keypress selected the next option only about two times in three
 * (measured - see `scripts/verify-keyboard.mjs`). Moving and selecting
 * explicitly makes the control deterministic.
 */
function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = NEXT_KEYS.has(event.key);
    const backward = PREV_KEYS.has(event.key);
    const isHome = event.key === "Home";
    const isEnd = event.key === "End";
    if (!forward && !backward && !isHome && !isEnd) return;

    event.preventDefault();

    const current = options.findIndex((option) => option.value === value);
    const from = current === -1 ? 0 : current;
    const index = isHome
      ? 0
      : isEnd
        ? options.length - 1
        : (from + (forward ? 1 : -1) + options.length) % options.length;

    const next = options[index];
    if (!next) return;

    onValueChange(next.value);
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`[role="radio"][value="${next.value}"]`)
      ?.focus();
  }

  return (
    <RadioGroupPrimitive.Root
      ref={rootRef}
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={cn(
        "grid gap-1 rounded-lg bg-surface-2 p-1 shadow-[var(--shadow-border)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            "flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium text-muted transition-[color,background-color,box-shadow] duration-150",
            "hover:text-fg focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
            "data-[state=checked]:bg-surface data-[state=checked]:text-fg data-[state=checked]:shadow-[var(--shadow-border)]",
          )}
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

export { Segmented };
