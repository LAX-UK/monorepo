import {
  THEME_STORAGE_KEY,
  type ThemePreference,
  parseThemeStorage,
  readThemeCookieFromDocument,
} from "./theme-cookie";

/** Read stored theme from cookie, then localStorage. Returns null when unset (treat as system). */
export function readStoredThemePreference(): ThemePreference | null {
  if (typeof document === "undefined") return null;

  const fromCookie = readThemeCookieFromDocument();
  if (fromCookie) return fromCookie;

  try {
    return parseThemeStorage(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}
