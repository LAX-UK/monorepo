import "server-only";

import type { ThemePreference } from "@auction/validators";
import { cookies } from "next/headers";
import { THEME_COOKIE_MAX_AGE_SEC, THEME_COOKIE_NAME, parseThemeCookie } from "./theme-cookie";

/**
 * Seed `lax_theme` from the signed-in profile when the browser has no cookie yet.
 * Returns the effective stored preference for SSR (cookie wins when present).
 */
export async function resolveEffectiveThemePreference(
  sessionTheme: ThemePreference | undefined,
): Promise<ThemePreference | null> {
  const cookieStore = await cookies();
  const cookieTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);
  if (cookieTheme) return cookieTheme;

  if (sessionTheme) {
    cookieStore.set(THEME_COOKIE_NAME, sessionTheme, {
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE_SEC,
      sameSite: "lax",
    });
    return sessionTheme;
  }

  return null;
}
