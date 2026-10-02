import { useState } from "react";
import { Eye, EyeOff, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listModels } from "@/lib/chat/functions";
import { useChatStore } from "@/lib/chat/store";
import { toast } from "sonner";

/**
 * First-run popup: collects the base URL + API key for the user's own
 * OpenAI-compatible endpoint, verifies them against /models, and persists the
 * pair to the store (localStorage) only after a successful test.
 */
export function ConnectDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: (models: string[]) => void;
}) {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const url = baseUrl.trim();
    const key = apiKey.trim();
    if (!url || !key) {
      setError("Both the base URL and the API key are required.");
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const result = await listModels({ data: { apiKey: key, baseUrl: url } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Connected - persist and, if nothing is selected yet, pick the first model.
      const current = useChatStore.getState().settings;
      const patch: Partial<typeof current> = { apiKey: key, baseUrl: url };
      if (!current.model || !result.models.includes(current.model)) {
        patch.model = result.models[0] ?? "";
      }
      if (current.compare && current.modelB && !result.models.includes(current.modelB)) {
        patch.modelB = result.models.find((m) => m !== patch.model) ?? "";
      }
      setSettings(patch);
      toast.success(
        result.models.length
          ? `Connected · ${result.models.length} models`
          : "Connected · no model list returned",
      );
      onOpenChange(false);
      onConnected?.(result.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,27rem)] p-6">
        <DialogTitle className="text-lg font-semibold text-fg">Connect an endpoint</DialogTitle>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Cove works with <span className="font-medium text-fg">OpenAI-compatible endpoints only</span>{" "}
          - any provider that serves <code className="font-mono text-xs">/models</code> and{" "}
          <code className="font-mono text-xs">/chat/completions</code> under its base URL.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">
              Base URL
            </span>
            <Input
              value={baseUrl}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://api.example.com/v1"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">
              API key
            </span>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                spellCheck={false}
                autoComplete="off"
                placeholder="sk-…"
                className="pr-11"
                onChange={(event) => setApiKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !testing) void connect();
                }}
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
          </label>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button className="w-full" disabled={testing} onClick={() => void connect()}>
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {testing ? "Testing connection…" : "Test & connect"}
          </Button>

          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-subtle">
            <span aria-hidden>🔒</span>
            Your key is stored in this browser only (localStorage) and sent only to the base URL
            you enter. Cove has no built-in keys and never phones home.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
