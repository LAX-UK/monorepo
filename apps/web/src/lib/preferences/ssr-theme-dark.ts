import type { ThemePreference } from "@auction/validators";
import { resolveIsDarkClass, secChPrefersDark } from "./resolve-theme";

/** Best-effort `<html class="dark">` on SSR from cookie + optional `Sec-CH-Prefers-Color-Scheme`. */
export function isSsrDarkClass(
  theme: ThemePreference | null,
  secChPrefersColorScheme: string | null,
): boolean {
  return resolveIsDarkClass({
    preference: theme,
    prefersDark: secChPrefersDark(secChPrefersColorScheme),
  });
}
