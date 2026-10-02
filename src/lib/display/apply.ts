import { DEFAULT_DISPLAY_SETTINGS, FONT_SCALE_PX, THEME_COLOR } from "@/lib/chat/constants";
import type { DisplaySettings } from "@/lib/chat/types";

export type ResolvedTheme = "light" | "dark";

/**
 * Persisted store key, shared with the pre-paint script in `__root.tsx`.
 * Must match the zustand `persist` name in `src/lib/chat/store.ts`, or the
 * pre-paint read finds nothing and every load flashes the wrong theme.
 */
export const STORE_KEY = "cove-chat-v3";

export function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function resolveTheme(mode: DisplaySettings["theme"], systemDark: boolean): ResolvedTheme {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

/**
 * Mirrors `DisplaySettings` onto `<html>` as data attributes, which is what the
 * CSS in `src/styles.css` keys off. Called on every settings change and on OS
 * theme/motion changes, so it must stay cheap and idempotent.
 */
export function applyDisplay(settings: DisplaySettings, systemDark: boolean): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;

  const theme = resolveTheme(settings.theme, systemDark);
  root.dataset.theme = theme;
  root.dataset.contrast = settings.highContrast ? "high" : "normal";
  root.dataset.width = settings.wideLayout ? "wide" : "standard";

  // "system" leaves the attribute off entirely so the prefers-reduced-motion
  // media query governs; an explicit choice overrides it.
  if (settings.motion === "system") delete root.dataset.motion;
  else root.dataset.motion = settings.motion;

  // Everything in the UI is rem-based, so one root font size scales it all.
  root.style.fontSize = `${FONT_SCALE_PX[settings.fontScale]}px`;
  root.style.colorScheme = theme;

  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);

  return theme;
}

/**
 * Runs before first paint, straight from `<head>`.
 *
 * Without this the server-rendered markup is always the dark palette, so anyone
 * on the light theme sees a dark flash on every load. Kept as a string (and
 * inlined rather than bundled) so it cannot be deferred.
 */
export const PREPAINT_SCRIPT = `(function(){try{
var d=${JSON.stringify(DEFAULT_DISPLAY_SETTINGS)};
var raw=localStorage.getItem(${JSON.stringify(STORE_KEY)});
var s=raw?JSON.parse(raw):null;
var p=(s&&s.state&&s.state.display)||{};
var m=function(k){return p[k]===undefined?d[k]:p[k]};
var dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
var t=m("theme");t=t==="system"?(dark?"dark":"light"):t;
var px={small:14,medium:16,large:18,xlarge:20}[m("fontScale")]||16;
var r=document.documentElement;
r.dataset.theme=t;
r.dataset.contrast=m("highContrast")?"high":"normal";
r.dataset.width=m("wideLayout")?"wide":"standard";
var mo=m("motion");if(mo!=="system")r.dataset.motion=mo;
r.style.fontSize=px+"px";
r.style.colorScheme=t;
var mc=document.querySelector('meta[name="theme-color"]');
if(mc)mc.setAttribute("content",t==="dark"?"#0b0b0c":"#fbfbfd");
}catch(e){}})();`;
