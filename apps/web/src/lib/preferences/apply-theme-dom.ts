import { THEME_COOKIE_MAX_AGE_SEC, THEME_COOKIE_NAME, THEME_STORAGE_KEY, type ThemePreference } from "./theme-cookie";

/** Resolved dark class for `document.documentElement` from stored preference. */
export function resolveEffectiveDark(mode: ThemePreference): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

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
}
