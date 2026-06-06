import type { ThemePreference } from "@auction/validators";

export function shouldFetchSessionForTheme(
  hasSessionCookie: boolean,
  existingTheme: ThemePreference | null,
): boolean {
  return existingTheme == null && hasSessionCookie;
}

/** Profile theme passed to SessionThemeSync, or null when device storage wins / unsigned. */
export function resolveSessionThemeSyncProp(params: {
  user: { uiPreferences?: { theme?: ThemePreference } | null } | null;
  existingTheme: ThemePreference | null;
  defaultTheme: ThemePreference;
}): ThemePreference | null {
  if (params.existingTheme) return null;
  if (!params.user) return null;
  return params.user.uiPreferences?.theme ?? params.defaultTheme;
}
