import type { ThemePreference } from "@auction/validators";

export type { ThemePreference } from "@auction/validators";

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
