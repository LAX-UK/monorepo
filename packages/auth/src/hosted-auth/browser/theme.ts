/**
 * Light and dark for the hosted pages, as LAX Account does it: a saved choice wins, otherwise the
 * system setting decides. The choice is kept per origin (no theme preference is shared across
 * LAX origins), under the key Account uses so the two behave alike.
 */
export const HOSTED_THEME_STORAGE_KEY = "lax-account-theme";

export type HostedTheme = "light" | "dark";

export function resolveHostedTheme(saved: string | null, systemPrefersDark: boolean): HostedTheme {
  if (saved === "light" || saved === "dark") return saved;
  return systemPrefersDark ? "dark" : "light";
}

export function otherTheme(theme: HostedTheme): HostedTheme {
  return theme === "dark" ? "light" : "dark";
}

/** What the toggle says it will do, and whether it is "on" (dark). */
export function themeToggleState(
  theme: HostedTheme,
  labels: { toDark: string; toLight: string },
): { label: string; pressed: "true" | "false" } {
  return theme === "dark"
    ? { label: labels.toLight, pressed: "true" }
    : { label: labels.toDark, pressed: "false" };
}
