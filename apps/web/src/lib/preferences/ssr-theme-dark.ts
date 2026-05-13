import type { ThemePreference } from "@auction/validators";

/** Best-effort `<html class="dark">` on SSR from cookie + optional `Sec-CH-Prefers-Color-Scheme`. */
export function isSsrDarkClass(
  theme: ThemePreference | null,
  secChPrefersColorScheme: string | null,
): boolean {
  const prefersDark = secChPrefersColorScheme === "dark";
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark;
}
