import { useState, type ReactNode } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearancePanel } from "@/components/chat/appearance-panel";
import type { ChatSettings, DisplaySettings } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SettingsSheet({
  open,
  onOpenChange,
  settings,
  onChange,
  onReset,
  providerModels,
  testing,
  onTest,
  display,
  onDisplayChange,
  onDisplayReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChatSettings;
  onChange: (patch: Partial<ChatSettings>) => void;
  onReset: () => void;
  providerModels: string[];
  testing: boolean;
  onTest: () => void;
  display: DisplaySettings;
  onDisplayChange: (patch: Partial<DisplaySettings>) => void;
  onDisplayReset: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Point Cove at your OpenAI-compatible endpoint, and set up how the app looks.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="connection" className="px-6 py-5">
          <TabsList>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <div className="flex flex-col gap-6 pt-6">
              <Field label="Base URL">
                <Input
                  value={settings.baseUrl}
                  spellCheck={false}
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => onChange({ baseUrl: event.target.value })}
                />
                <p className="mt-1.5 text-xs text-subtle">
                  OpenAI-compatible endpoints only - the URL must serve /models and
                  /chat/completions.
                </p>
              </Field>
              <Field label="API key">
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={settings.apiKey}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="sk-…"
                    className="pr-11"
                    onChange={(event) => onChange({ apiKey: event.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:text-fg"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-subtle">
                  Stored only in this browser&apos;s localStorage and sent only to the base URL
                  above. Cove has no built-in key.
                </p>
              </Field>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={onTest} disabled={testing}>
                  <RefreshCw className={cn("size-4", testing && "animate-spin")} />
                  Test connection
                </Button>
              </div>

              <section>
                <Label className="mb-2 block">Model</Label>
                <Input
                  value={settings.model}
                  spellCheck={false}
                  placeholder="provider/model-name"
                  onChange={(event) => onChange({ model: event.target.value })}
                />
                {providerModels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {providerModels.slice(0, 18).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onChange({ model: id });
                        }}
                        className={cn(
                          "rounded-full px-2.5 py-1 font-mono text-xs",
                          settings.model === id
                            ? "bg-accent text-accent-fg"
                            : "bg-surface-2 text-muted hover:text-fg",
                        )}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-subtle">
                    Run “Test connection” to load the model list from your endpoint.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <Label className="block">Compare mode</Label>
                    <p className="mt-0.5 text-xs text-subtle">
                      Answer every prompt with two models, side by side.
                    </p>
                  </div>
                  <Switch
                    checked={settings.compare}
                    onCheckedChange={(checked) => onChange({ compare: checked })}
                  />
                </div>
                {settings.compare ? (
                  <div>
                    <Label className="mb-2 block">Second model</Label>
                    <Input
                      value={settings.modelB}
                      spellCheck={false}
                      placeholder="provider/other-model"
                      onChange={(event) => onChange({ modelB: event.target.value })}
                    />
                    {providerModels.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {providerModels.slice(0, 18).map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onChange({ modelB: id })}
                            className={cn(
                              "rounded-full px-2.5 py-1 font-mono text-xs",
                              settings.modelB === id
                                ? "bg-accent text-accent-fg"
                                : "bg-surface-2 text-muted hover:text-fg",
                            )}
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <Field label={`Temperature · ${settings.temperature.toFixed(1)}`}>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(event) => onChange({ temperature: Number(event.target.value) })}
                  className="h-11 w-full accent-accent"
                />
              </Field>
              <Field label="Max tokens">
                <Input
                  type="number"
                  min={64}
                  max={8192}
                  value={settings.maxTokens}
                  onChange={(event) =>
                    onChange({ maxTokens: Math.max(64, Number(event.target.value) || 64) })
                  }
                />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-3 shadow-[var(--shadow-border)]">
                <div>
                  <p className="text-sm font-medium text-fg">Streaming</p>
                  <p className="text-xs text-subtle">Show tokens as they arrive</p>
                </div>
                <Switch
                  checked={settings.stream}
                  onCheckedChange={(checked) => onChange({ stream: checked })}
                />
              </div>

              <section>
                <Label className="mb-1 block">Estimated pricing (optional)</Label>
                <p className="mb-3 text-xs text-subtle">
                  USD per 1M tokens, used only to show a cost estimate next to the token counts.
                  Leave at 0 to hide costs.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Input">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={settings.priceInputPerM}
                      onChange={(event) =>
                        onChange({ priceInputPerM: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                  </Field>
                  <Field label="Output">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={settings.priceOutputPerM}
                      onChange={(event) =>
                        onChange({ priceOutputPerM: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                  </Field>
                </div>
              </section>

              <Field label="System prompt">
                <Textarea
                  value={settings.systemPrompt}
                  rows={10}
                  className="min-h-32 resize-y font-mono text-xs"
                  placeholder="Instructions sent before every conversation"
                  onChange={(event) => onChange({ systemPrompt: event.target.value })}
                />
                <p className="mt-1.5 text-xs text-subtle">
                  Sent as the first message of every conversation, and re-sent on every turn - so
                  a long prompt adds to each message&apos;s input-token count. The default is a
                  single line naming the assistant; add your own rules here if you want them.
                </p>
              </Field>
              <Button
                variant="ghost"
                onClick={() => {
                  onReset();
                  toast.success("Settings restored");
                }}
              >
                Restore defaults
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="pt-6">
              <AppearancePanel
                display={display}
                onChange={onDisplayChange}
                onReset={onDisplayReset}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
