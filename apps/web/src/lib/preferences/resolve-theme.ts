import type { ThemePreference } from "@auction/validators";

export const PREFERS_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** Whether `Sec-CH-Prefers-Color-Scheme` indicates a dark OS preference. */
export function secChPrefersDark(header: string | null | undefined): boolean {
  return header === "dark";
}

/**
 * Resolve whether `<html class="dark">` should be active.
 * `null` preference follows system (`prefersDark`).
 */
export function resolveIsDarkClass(params: {
  preference: ThemePreference | null;
  prefersDark: boolean;
}): boolean {
  const preference = params.preference ?? "system";
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return params.prefersDark;
}
