/**
 * Theme values and the default, without the schema library: the theme cookie reads the default in
 * the first scripts of every page. `ui-preferences.ts` builds its schemas from these.
 */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export const DEFAULT_THEME_PREFERENCE =
  "system" as const satisfies (typeof THEME_PREFERENCES)[number];
