import { useEffect } from "react";
import { useChatStore } from "@/lib/chat/store";
import { applyDisplay, prefersDark } from "@/lib/display/apply";
import { DARK_QUERY, MOTION_QUERY, useMediaQuery } from "@/lib/display/use-resolved-theme";

/**
 * Mirrors display settings onto `<html>` and keeps them in sync with the OS.
 * Mounted once near the root; renders nothing.
 *
 * `reducedMotion` is part of the dependency list even though it is not read here,
 * so toggling the OS reduce-motion setting re-runs `applyDisplay` and the
 * resolved `data-motion` attribute stays truthful.
 */
export function DisplayEffects() {
  const display = useChatStore((state) => state.display);
  const systemDark = useMediaQuery(DARK_QUERY, prefersDark());
  const reducedMotion = useMediaQuery(MOTION_QUERY, false);

  useEffect(() => {
    applyDisplay(display, systemDark);
  }, [display, systemDark, reducedMotion]);

  return null;
}
