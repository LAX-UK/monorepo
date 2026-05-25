import "server-only";

import type { ThemePreference } from "@auction/validators";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, parseThemeCookie } from "./theme-cookie";

/** Pure resolver: cookie wins, then signed-in profile theme. Does not mutate cookies. */
export function resolveThemePreference(
  cookieValue: string | undefined,
  sessionTheme: ThemePreference | undefined,
): ThemePreference | null {
  const cookieTheme = parseThemeCookie(cookieValue);
  if (cookieTheme) return cookieTheme;
  if (sessionTheme) return sessionTheme;
  return null;
}

/** Effective theme for SSR (cookie wins when present, else profile preference). */
export async function resolveEffectiveThemePreference(
  sessionTheme: ThemePreference | undefined,
): Promise<ThemePreference | null> {
  const cookieStore = await cookies();
  return resolveThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value, sessionTheme);
}
