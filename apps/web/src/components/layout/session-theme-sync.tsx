"use client";

import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { readStoredThemePreference } from "@/lib/preferences/read-stored-theme-preference";
import { DEFAULT_THEME_PREFERENCE, type ThemePreference } from "@/lib/preferences/theme-cookie";
import { useEffect } from "react";

type Props = { theme: ThemePreference | null };

/** Hydrate theme from profile when the device has no stored preference; otherwise honour device storage.
 * When stored preference equals DEFAULT_THEME_PREFERENCE (middleware seed) and profile theme is
 * available, prefer profile — treats the seed as "unset" that profile can override.
 */
export function SessionThemeSync({ theme }: Props) {
  useEffect(() => {
    const stored = readStoredThemePreference();
    const storedIsDefaultSeed = stored === DEFAULT_THEME_PREFERENCE;
    if (stored && !storedIsDefaultSeed) {
      applyThemeDom(stored);
      return;
    }
    if (theme) {
      applyThemeDom(theme);
      return;
    }
    if (stored) {
      applyThemeDom(stored);
    }
  }, [theme]);

  return null;
}
