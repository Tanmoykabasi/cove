import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isChatModel } from "./constants";
import { parseProviderError } from "./messages";

const connectionSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const listModels = createServerFn({ method: "POST" })
  .validator(connectionSchema)
  .handler(async ({ data }) => {
    const { resolveConnection } = await import("./secrets.server");
    const { apiKey, baseUrl } = resolveConnection(data.apiKey, data.baseUrl);

    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const raw = await res.text();
      if (!res.ok) {
        return {
          ok: false as const,
          error: parseProviderError(raw, res.status),
          models: [] as string[],
        };
      }
      const json = JSON.parse(raw) as {
        data?: { id?: string; supported_endpoint_types?: string[] }[];
      };
      const models = (json.data ?? [])
        .map((item) => item)
        .filter(
          (item): item is { id: string; supported_endpoint_types?: string[] } =>
            typeof item.id === "string" &&
            item.id.length > 0 &&
            isChatModel(item.id, item.supported_endpoint_types),
        )
        .map((item) => item.id);

      // The provider decides what exists; we just present it alphabetically.
      models.sort((a, b) => a.localeCompare(b));

      return { ok: true as const, models, error: null };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Could not reach the API",
        models: [] as string[],
      };
    }
  });
