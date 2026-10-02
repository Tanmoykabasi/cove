import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { FONT_SCALE_LABELS, MOTION_LABELS, THEME_LABELS } from "@/lib/chat/constants";
import type { DisplaySettings, FontScale, MotionPreference, ThemeMode } from "@/lib/chat/types";

const WIDTH_LABELS = [
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
] as const;

/**
 * Display and accessibility preferences. Every control writes straight to the
 * store, and `DisplayEffects` mirrors the store onto `<html>` - so changes are
 * visible immediately and are persisted by the same zustand `persist` layer as
 * the rest of the app.
 */
export function AppearancePanel({
  display,
  onChange,
  onReset,
}: {
  display: DisplaySettings;
  onChange: (patch: Partial<DisplaySettings>) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Setting label="Theme" description="System follows your device's light or dark setting.">
        <Segmented<ThemeMode>
          ariaLabel="Theme"
          value={display.theme}
          onValueChange={(theme) => onChange({ theme })}
          options={THEME_LABELS}
        />
      </Setting>

      <Setting label="Text size" description="Scales the whole interface, not just the transcript.">
        <Segmented<FontScale>
          ariaLabel="Text size"
          value={display.fontScale}
          onValueChange={(fontScale) => onChange({ fontScale })}
          options={FONT_SCALE_LABELS}
        />
      </Setting>

      <Setting
        label="Reading width"
        description="How wide the transcript and composer stretch on large screens."
      >
        <Segmented<"standard" | "wide">
          ariaLabel="Reading width"
          value={display.wideLayout ? "wide" : "standard"}
          onValueChange={(value) => onChange({ wideLayout: value === "wide" })}
          options={WIDTH_LABELS}
        />
      </Setting>

      <Setting label="Motion" description="System respects your device's reduce-motion setting.">
        <Segmented<MotionPreference>
          ariaLabel="Motion"
          value={display.motion}
          onValueChange={(motion) => onChange({ motion })}
          options={MOTION_LABELS}
        />
      </Setting>

      <ToggleRow
        id="display-contrast"
        label="Increase contrast"
        description="Strengthens secondary text and borders for readability."
        checked={display.highContrast}
        onCheckedChange={(highContrast) => onChange({ highContrast })}
      />

      <Button variant="ghost" onClick={onReset}>
        <RotateCcw />
        Restore appearance defaults
      </Button>
    </div>
  );
}

function Setting({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium text-fg">{label}</h3>
      <p className="mt-0.5 mb-2 text-xs text-subtle">{description}</p>
      {children}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-3 shadow-[var(--shadow-border)]">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-subtle">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
