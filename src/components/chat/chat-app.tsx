import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Columns2, Menu, Settings } from "lucide-react";
import { Sidebar } from "@/components/chat/sidebar";
import { Thread } from "@/components/chat/thread";
import { Composer } from "@/components/chat/composer";
import { SettingsSheet } from "@/components/chat/settings-sheet";
import { Landing } from "@/components/chat/landing";
import { UsageChip } from "@/components/chat/usage-chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listModels } from "@/lib/chat/functions";
import { looksLikeProviderError, toApiMessages } from "@/lib/chat/messages";
import { sendChat } from "@/lib/chat/stream";
import { hasConnection, useChatStore } from "@/lib/chat/store";
import type { Attachment } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ChatApp() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const settings = useChatStore((s) => s.settings);
  const hydrated = useChatStore((s) => s.hydrated);
  const newChat = useChatStore((s) => s.newChat);
  const setActive = useChatStore((s) => s.setActive);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const addMessage = useChatStore((s) => s.addMessage);
  const patchMessage = useChatStore((s) => s.patchMessage);
  const editUserMessage = useChatStore((s) => s.editUserMessage);
  const setSettings = useChatStore((s) => s.setSettings);
  const resetSettings = useChatStore((s) => s.resetSettings);
  const display = useChatStore((s) => s.display);
  const setDisplay = useChatStore((s) => s.setDisplay);
  const resetDisplay = useChatStore((s) => s.resetDisplay);
  const ensureConversation = useChatStore((s) => s.ensureConversation);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [running, setRunning] = useState(0);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const connected = hasConnection(settings);
  const pending = running > 0;

  /**
   * Validates the connection and refreshes the provider model list.
   *
   * `silent` is for the automatic check on mount: it must not toast, or every
   * single app load ends with a "Connected · N models" popup, and a transient
   * provider blip would raise an error toast for something the user never asked
   * for. Only the explicit "Test connection" button reports back.
   */
  const testConnection = useCallback(async ({ silent = false } = {}) => {
    const latest = useChatStore.getState().settings;
    if (!hasConnection(latest)) return;
    if (!silent) setTesting(true);
    try {
      const result = await listModels({
        data: { apiKey: latest.apiKey, baseUrl: latest.baseUrl },
      });
      if (!result.ok) {
        if (!silent) toast.error(result.error);
        return;
      }
      setProviderModels(result.models);

      // The provider may drop a model between sessions, so confirm the saved
      // selections still exist instead of sending with a dead id.
      if (result.models.length > 0) {
        const { settings: current, setSettings: apply } = useChatStore.getState();
        const patch: Partial<typeof current> = {};
        if (!current.model || !result.models.includes(current.model)) {
          patch.model = result.models[0] ?? "";
        }
        if (current.modelB && !result.models.includes(current.modelB)) {
          patch.modelB = result.models.find((m) => m !== (patch.model ?? current.model)) ?? "";
        }
        if (Object.keys(patch).length > 0) apply(patch);
      }

      if (!silent) {
        toast.success(
          result.models.length
            ? `Connected · ${result.models.length} models`
            : "Connected · no model list returned",
        );
      }
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Connection failed");
      }
    } finally {
      if (!silent) setTesting(false);
    }
  }, []);

  useEffect(() => {
    if (!hasConnection(useChatStore.getState().settings)) return;
    ensureConversation();
  }, [ensureConversation, connected]);

  useEffect(() => {
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      void testConnection({ silent: true });
    };
    const persist = useChatStore.persist;
    if (persist.hasHydrated()) apply();
    return persist.onFinishHydration(apply);
  }, [testConnection]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const usageTotals = useMemo(() => {
    let promptTokens = 0;
    let completionTokens = 0;
    for (const message of active?.messages ?? []) {
      promptTokens += message.usage?.promptTokens ?? 0;
      completionTokens += message.usage?.completionTokens ?? 0;
    }
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
  }, [active?.messages]);

  /** Options for the header model selects: the live provider list, plus any
   *  saved/custom id so the current selection is always visible. */
  function modelOptions(exclude?: string): string[] {
    const options = [...providerModels];
    for (const id of [settings.model, settings.modelB]) {
      if (id && !options.includes(id)) options.push(id);
    }
    return options.filter((id) => id !== exclude);
  }

  function toggleCompare() {
    if (settings.compare) {
      setSettings({ compare: false });
      return;
    }
    const second =
      settings.modelB ||
      providerModels.find((id) => id !== settings.model) ||
      modelOptions(settings.model)[0];
    if (!settings.model || !second) {
      toast.error("Connect an endpoint with at least two models to compare.");
      return;
    }
    setSettings({ compare: true, modelB: second });
  }

  /**
   * Streams one assistant reply. `lane`/`model` drive compare mode; history is
   * filtered so each lane only ever sees its own previous answers (plus all
   * user turns), keeping the two conversations independent.
   */
  async function completeAssistant(
    conversationId: string,
    assistantId: string,
    model: string,
    lane: "a" | "b" | undefined,
    signal: AbortSignal,
  ) {
    const snapshot = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    const history = (snapshot?.messages ?? []).filter(
      (m) => m.id !== assistantId && (!lane || m.lane !== (lane === "a" ? "b" : "a")),
    );
    const latest = useChatStore.getState().settings;
    const startedAt = performance.now();

    try {
      let assembled = "";
      const result = await sendChat(
        {
          apiKey: latest.apiKey,
          baseUrl: latest.baseUrl,
          model,
          messages: toApiMessages(history, latest.systemPrompt),
          temperature: latest.temperature,
          maxTokens: latest.maxTokens,
          stream: latest.stream,
          webSearch: latest.webSearch,
          thinking: latest.thinking,
        },
        {
          onDelta: (content) => {
            assembled = content;
            patchMessage(conversationId, assistantId, { content: assembled });
          },
          onReasoning: (text) => patchMessage(conversationId, assistantId, { reasoning: text }),
          onModel: (responded) => patchMessage(conversationId, assistantId, { model: responded }),
          onSources: (sources) => patchMessage(conversationId, assistantId, { sources }),
          onUsage: (usage) => patchMessage(conversationId, assistantId, { usage }),
        },
        signal,
      );
      if (result.text && result.text !== assembled) {
        assembled = result.text;
        patchMessage(conversationId, assistantId, { content: assembled });
      }
      if (result.reasoning) {
        patchMessage(conversationId, assistantId, { reasoning: result.reasoning });
      }
      if (result.sources.length) {
        patchMessage(conversationId, assistantId, { sources: result.sources });
      }
      if (result.usage) {
        patchMessage(conversationId, assistantId, { usage: result.usage });
      }
      if (looksLikeProviderError(assembled || result.text)) {
        // 200 OK with a failure notice in the body - show it as an error.
        patchMessage(conversationId, assistantId, {
          content: "",
          error: (assembled || result.text).trim(),
        });
      } else if (!assembled && !result.text && !result.reasoning) {
        patchMessage(conversationId, assistantId, {
          error: "The model returned an empty reply.",
        });
      }
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") {
        const current = useChatStore
          .getState()
          .conversations.find((c) => c.id === conversationId)
          ?.messages.find((m) => m.id === assistantId);
        if (!current?.content && !current?.reasoning) {
          patchMessage(conversationId, assistantId, { error: "Stopped." });
        }
      } else {
        patchMessage(conversationId, assistantId, {
          error: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    } finally {
      // Wall-clock for the whole reply, so a stopped or failed turn still
      // reports how long the provider actually took.
      patchMessage(conversationId, assistantId, {
        latencyMs: Math.round(performance.now() - startedAt),
      });
    }
  }

  /** Starts one or two (compare mode) assistant replies for the current turn. */
  async function runTurn(conversationId: string) {
    const latest = useChatStore.getState().settings;
    const compare = Boolean(latest.compare && latest.model && latest.modelB);
    const controller = new AbortController();
    abortRef.current = controller;

    const lanes: { id: string; model: string; lane: "a" | "b" | undefined }[] = compare
      ? [
          { id: crypto.randomUUID(), model: latest.model, lane: "a" },
          { id: crypto.randomUUID(), model: latest.modelB, lane: "b" },
        ]
      : [{ id: crypto.randomUUID(), model: latest.model, lane: undefined }];

    for (const entry of lanes) {
      addMessage(conversationId, {
        id: entry.id,
        role: "assistant",
        content: "",
        model: entry.model,
        lane: entry.lane,
        createdAt: Date.now(),
      });
    }

    setRunning((n) => n + lanes.length);
    try {
      await Promise.all(
        lanes.map((entry) =>
          completeAssistant(conversationId, entry.id, entry.model, entry.lane, controller.signal),
        ),
      );
    } finally {
      setRunning((n) => Math.max(0, n - lanes.length));
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function handleSend(text: string, attachments: Attachment[]) {
    if (!settings.model) {
      toast.error("Pick a model in Settings first.");
      return;
    }
    const conversationId = ensureConversation();
    addMessage(conversationId, {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachments,
      createdAt: Date.now(),
    });
    await runTurn(conversationId);
  }

  async function handleEditUser(messageId: string, content: string) {
    const conversationId = ensureConversation();
    abortRef.current?.abort();
    editUserMessage(conversationId, messageId, content);
    await runTurn(conversationId);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  // First run (or a wiped connection): the landing page with the connect popup.
  // The dialog hands its verified model list back so the header pickers and
  // compare mode have something to work with on the very first render.
  if (hydrated && !connected) {
    return <Landing onConnected={setProviderModels} />;
  }

  return (
    <div className="flex h-dvh bg-bg text-fg">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <Sidebar
          conversations={conversations}
          activeId={active?.id ?? null}
          onNew={() => newChat()}
          onSelect={setActive}
          onDelete={deleteChat}
        />
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="bg-surface p-0" showClose={false}>
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <Sidebar
            conversations={conversations}
            activeId={active?.id ?? null}
            onNew={() => {
              newChat();
              setMobileNav(false);
            }}
            onSelect={(id) => {
              setActive(id);
              setMobileNav(false);
            }}
            onDelete={deleteChat}
            onClose={() => setMobileNav(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
          <Button
            size="icon-sm"
            variant="ghost"
            className="md:hidden"
            aria-label="Open conversations"
            onClick={() => setMobileNav(true)}
          >
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{active?.title ?? "New chat"}</p>
            <p className="truncate font-mono text-xs text-subtle">
              {settings.compare && settings.modelB
                ? `${settings.model || "-"} vs ${settings.modelB}`
                : settings.model || "No model selected"}
            </p>
          </div>

          <div className="hidden items-center gap-1.5 lg:flex">
            <ModelSelect
              ariaLabel="Model"
              value={settings.model}
              options={modelOptions()}
              onChange={(model) => setSettings({ model })}
            />
            {settings.compare ? (
              <ModelSelect
                ariaLabel="Second model"
                value={settings.modelB}
                options={modelOptions()}
                onChange={(modelB) => setSettings({ modelB })}
              />
            ) : null}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant={settings.compare ? "secondary" : "ghost"}
                aria-label="Compare two models"
                aria-pressed={settings.compare}
                onClick={toggleCompare}
                className={cn(settings.compare && "text-accent")}
              >
                <Columns2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Compare two models side by side</TooltipContent>
          </Tooltip>

          <UsageChip
            totals={usageTotals}
            priceInputPerM={settings.priceInputPerM}
            priceOutputPerM={settings.priceOutputPerM}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </header>

        <Thread
          messages={active?.messages ?? []}
          pending={pending}
          webSearch={Boolean(settings.webSearch)}
          thinking={Boolean(settings.thinking)}
          onEditUser={(id, content) => void handleEditUser(id, content)}
        />
        <Composer
          pending={pending}
          webSearch={Boolean(settings.webSearch)}
          thinking={Boolean(settings.thinking)}
          onWebSearchChange={(value) => setSettings({ webSearch: value })}
          onThinkingChange={(value) => setSettings({ thinking: value })}
          onSend={(t, a) => void handleSend(t, a)}
          onStop={handleStop}
        />
      </div>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
        onReset={resetSettings}
        providerModels={providerModels}
        testing={testing}
        onTest={() => void testConnection()}
        display={display}
        onDisplayChange={setDisplay}
        onDisplayReset={resetDisplay}
      />
    </div>
  );
}

/** Compact header dropdown listing the provider's models (plus any custom id). */
function ModelSelect({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: string[];
  onChange: (model: string) => void;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 max-w-44 rounded-md bg-surface-2 px-2 font-mono text-xs text-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      {!value ? <option value="">Select model…</option> : null}
      {options.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  );
}
