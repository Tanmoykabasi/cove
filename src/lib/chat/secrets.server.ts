/**
 * Cove ships with no built-in key or endpoint: both halves of the connection
 * are entered by the user, live in their browser's localStorage, and are sent
 * with each request only so this server can relay it to the user's own
 * OpenAI-compatible endpoint (browser CORS makes a direct call unreliable).
 * Nothing here is persisted or logged.
 */
export function resolveConnection(apiKey?: string, baseUrl?: string) {
  const key = apiKey?.trim();
  const url = baseUrl?.trim().replace(/\/+$/, "");
  if (!key) throw new Error("Add your API key in Settings");
  if (!url) throw new Error("Add your base URL in Settings");
  if (!/^https?:\/\//i.test(url)) throw new Error("Base URL must start with http:// or https://");
  return { apiKey: key, baseUrl: url };
}
