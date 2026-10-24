import type { StaffTheme } from "./types.js";

/**
 * Theme for a staff app that has no theme system of its own (LAX Admin). The server reads the
 * cookie and renders `<html>` with the right class, so the first paint is already in the chosen
 * scheme. "system" follows the operating system through `color-scheme` (see theme.css).
 */
export const STAFF_THEME_COOKIE = "lax_staff_theme";

export function parseStaffTheme(value: string | undefined | null): StaffTheme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** Attributes for `<html>` for a theme: the `dark` class, or the follow-the-system marker. */
export function staffThemeHtmlAttributes(theme: StaffTheme): {
  className: string | undefined;
  "data-staff-theme": StaffTheme;
} {
  return { className: theme === "dark" ? "dark" : undefined, "data-staff-theme": theme };
}

/** Applies a theme in the browser at once and remembers it for the next request. */
export function applyStaffTheme(theme: StaffTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.staffTheme = theme;
  document.cookie = `${STAFF_THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
