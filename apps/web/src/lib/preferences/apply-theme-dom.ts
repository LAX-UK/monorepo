import { PREFERS_DARK_MEDIA_QUERY, resolveIsDarkClass } from "./resolve-theme";
import {
  THEME_COOKIE_MAX_AGE_SEC,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme-cookie";

function readPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches;
}

/** Resolved dark class for `document.documentElement` from stored preference. */
export function resolveEffectiveDark(mode: ThemePreference): boolean {
  return resolveIsDarkClass({
    preference: mode,
    prefersDark: readPrefersDark(),
  });
}

/** Dispatched after `applyThemeDom` persists preference (same-tab listener sync). */
export const THEME_PREFERENCE_CHANGE_EVENT = "lax:theme-preference-change";

/** Apply theme to DOM, `localStorage`, and non-HttpOnly cookie (mirrors server action). */
export function applyThemeDom(mode: ThemePreference): void {
  if (typeof document === "undefined") return;
  const isDark = resolveEffectiveDark(mode);
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
  const maxAge = THEME_COOKIE_MAX_AGE_SEC;
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(mode)};path=/;max-age=${maxAge};SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_CHANGE_EVENT));
}

/** Toggle `<html class="dark">` for system mode without rewriting stored preference. */
export function applySystemThemeDom(): void {
  if (typeof document === "undefined") return;
  const isDark = resolveIsDarkClass({
    preference: "system",
    prefersDark: readPrefersDark(),
  });
  document.documentElement.classList.toggle("dark", isDark);
}
