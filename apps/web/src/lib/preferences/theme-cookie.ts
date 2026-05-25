import type { ThemePreference } from "@auction/validators";
import { DEFAULT_THEME_PREFERENCE } from "@auction/validators";

export type { ThemePreference } from "@auction/validators";

export { DEFAULT_THEME_PREFERENCE };

/** Cookie + localStorage key for colour scheme (light / dark / follow system). */
export const THEME_COOKIE_NAME = "lax_theme";

export const THEME_STORAGE_KEY = "theme";

export const THEME_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function parseThemeCookie(raw: string | undefined): ThemePreference | null {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return null;
}

export function parseThemeStorage(raw: string | null): ThemePreference | null {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return null;
}

/** Read `lax_theme` from `document.cookie`. Client-only. */
export function readThemeCookieFromDocument(): ThemePreference | null {
  if (typeof document === "undefined") return null;

  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== THEME_COOKIE_NAME) continue;
    return parseThemeCookie(decodeURIComponent(trimmed.slice(eq + 1)));
  }

  return null;
}
