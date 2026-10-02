import { useEffect, useState } from "react";
import { useChatStore } from "@/lib/chat/store";
import type { ResolvedTheme } from "./apply";

export const DARK_QUERY = "(prefers-color-scheme: dark)";
export const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Live `matchMedia` result, so OS changes are picked up without a reload. */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const [matches, setMatches] = useState(fallback);

  useEffect(() => {
    if (!window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * The theme actually in effect once `system` has been resolved against the OS.
 * Needed for the toast renderer, which cannot read CSS variables.
 */
export function useResolvedTheme(): ResolvedTheme {
  const mode = useChatStore((state) => state.display.theme);
  const systemDark = useMediaQuery(DARK_QUERY, true);
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}
