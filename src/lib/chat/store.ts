import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from "./constants";
import type { ChatMessage, ChatSettings, Conversation, DisplaySettings } from "./types";
import { titleFromPrompt } from "./messages";

function uid(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

/**
 * Connection starts empty on purpose: Cove ships with no default endpoint or
 * key, so the first run always goes through the landing page's connect dialog.
 */
export const defaultSettings = (): ChatSettings => ({
  apiKey: "",
  baseUrl: "",
  model: "",
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  stream: true,
  webSearch: false,
  thinking: false,
  compare: false,
  modelB: "",
  priceInputPerM: 0,
  priceOutputPerM: 0,
});

/** True when the user has entered both halves of a connection. */
export function hasConnection(settings: Pick<ChatSettings, "apiKey" | "baseUrl">): boolean {
  return Boolean(settings.apiKey.trim() && settings.baseUrl.trim());
}

function emptyConversation(): Conversation {
  const t = now();
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    createdAt: t,
    updatedAt: t,
  };
}

type ChatState = {
  conversations: Conversation[];
  activeId: string | null;
  settings: ChatSettings;
  display: DisplaySettings;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  ensureConversation: () => string;
  newChat: () => string;
  setActive: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  editUserMessage: (conversationId: string, messageId: string, content: string) => void;
  setSettings: (patch: Partial<ChatSettings>) => void;
  resetSettings: () => void;
  setDisplay: (patch: Partial<DisplaySettings>) => void;
  resetDisplay: () => void;
  clearAll: () => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      settings: defaultSettings(),
      display: { ...DEFAULT_DISPLAY_SETTINGS },
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      ensureConversation: () => {
        const { conversations, activeId } = get();
        if (activeId && conversations.some((c) => c.id === activeId)) return activeId;
        if (conversations[0]) {
          set({ activeId: conversations[0].id });
          return conversations[0].id;
        }
        const created = emptyConversation();
        set({ conversations: [created], activeId: created.id });
        return created.id;
      },
      newChat: () => {
        const created = emptyConversation();
        set((state) => ({
          conversations: [created, ...state.conversations],
          activeId: created.id,
        }));
        return created.id;
      },
      setActive: (id) => set({ activeId: id }),
      deleteChat: (id) => {
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== id);
          const activeId = state.activeId === id ? (conversations[0]?.id ?? null) : state.activeId;
          return { conversations, activeId };
        });
        if (get().conversations.length === 0) get().newChat();
      },
      renameChat: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: now() } : c,
          ),
        }));
      },
      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const isFirst = c.messages.length === 0 && message.role === "user";
            const title = isFirst
              ? titleFromPrompt(message.content, (message.attachments?.length ?? 0) > 0)
              : c.title;
            return {
              ...c,
              title,
              messages: [...c.messages, message],
              updatedAt: now(),
            };
          }),
        }));
      },
      patchMessage: (conversationId, messageId, patch) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  updatedAt: now(),
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
                },
          ),
        }));
      },
      editUserMessage: (conversationId, messageId, content) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            if (idx < 0 || c.messages[idx]?.role !== "user") return c;
            const current = c.messages[idx];
            const messages = c.messages
              .slice(0, idx + 1)
              .map((m, i) => (i === idx ? { ...m, content } : m));
            const title =
              idx === 0
                ? titleFromPrompt(content, (current.attachments?.length ?? 0) > 0)
                : c.title;
            return { ...c, messages, title, updatedAt: now() };
          }),
        }));
      },
      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      // "Restore defaults" covers preferences, not the connection: wiping the
      // key and base URL here would silently throw the user back to first run.
      resetSettings: () =>
        set((state) => ({
          settings: {
            ...defaultSettings(),
            apiKey: state.settings.apiKey,
            baseUrl: state.settings.baseUrl,
            model: state.settings.model,
            modelB: state.settings.modelB,
          },
        })),
      setDisplay: (patch) => set((state) => ({ display: { ...state.display, ...patch } })),
      resetDisplay: () => set({ display: { ...DEFAULT_DISPLAY_SETTINGS } }),
      clearAll: () => {
        const created = emptyConversation();
        set({ conversations: [created], activeId: created.id });
      },
    }),
    {
      // v3: connections saved under v2 could contain the old built-in default
      // endpoint, which has been removed from the product - start those fresh.
      name: "cove-chat-v3",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
        settings: state.settings,
        display: state.display,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        const storedPrompt = p.settings?.systemPrompt;
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...p.settings,
            // Keep whatever model the user picked. ChatApp revalidates it
            // against /v1/models and only falls back if the provider dropped it.
            model: p.settings?.model?.trim() || "",
            // Sessions saved before the default prompt existed stored an empty
            // string, which would otherwise keep suppressing it forever.
            systemPrompt: storedPrompt?.trim() ? storedPrompt : DEFAULT_SYSTEM_PROMPT,
          },
          // Spread over the defaults so options added in a later release still
          // get a value for sessions saved before they existed.
          display: { ...DEFAULT_DISPLAY_SETTINGS, ...p.display },
        };
      },
      // ChatApp gates the first-run landing on this, so it must flip as soon
      // as the persisted state (or the knowledge there is none) is applied.
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/** Conversations kept when storage is still over budget after dropping images. */
const QUOTA_TRIM_LIMIT = 20;

type PersistedState = {
  conversations?: Conversation[];
  activeId?: string | null;
  settings?: ChatSettings;
  display?: Partial<DisplaySettings>;
};

/** Last-resort mirror so state is not lost outright when localStorage is full. */
const memoryMirror = new Map<string, string>();

function stripAttachments(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.attachments?.length ? { ...message, attachments: undefined } : message,
    ),
  }));
}

/**
 * Attachments are stored as base64 data URLs (up to four per message), so a few
 * image-heavy chats can blow the ~5MB localStorage budget. A raw
 * QuotaExceededError here loses the entire history, so degrade instead: retry
 * without image payloads, then trim to the newest conversations, and only then
 * fall back to memory.
 */
function safeStorage(): StateStorage {
  const write = (name: string, state: PersistedState) => {
    const envelope = JSON.stringify({ state, version: 0 });
    try {
      localStorage.setItem(name, envelope);
      return true;
    } catch {
      return false;
    }
  };

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return memoryMirror.get(name) ?? null;
      }
    },
    setItem: (name, raw) => {
      try {
        localStorage.setItem(name, raw);
        memoryMirror.delete(name);
        return;
      } catch {
        /* quota exceeded - try the slimmer variants below */
      }

      let parsed: { state?: PersistedState };
      try {
        parsed = JSON.parse(raw) as { state?: PersistedState };
      } catch {
        memoryMirror.set(name, raw);
        return;
      }
      const state = parsed.state;
      if (!state) {
        memoryMirror.set(name, raw);
        return;
      }

      // 1) Drop image payloads, keep every conversation and all text.
      const withoutImages: PersistedState = {
        ...state,
        conversations: stripAttachments(state.conversations ?? []),
      };
      if (write(name, withoutImages)) return;

      // 2) Still too big - keep only the newest conversations, no images.
      const trimmed: PersistedState = {
        ...withoutImages,
        conversations: [...(withoutImages.conversations ?? [])]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, QUOTA_TRIM_LIMIT),
      };
      if (write(name, trimmed)) return;

      memoryMirror.set(name, raw);
    },
    removeItem: (name) => {
      memoryMirror.delete(name);
      try {
        localStorage.removeItem(name);
      } catch {
        /* nothing more we can do */
      }
    },
  };
}

export function activeConversation(): Conversation | undefined {
  const { conversations, activeId } = useChatStore.getState();
  return conversations.find((c) => c.id === activeId);
}
