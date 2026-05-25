"use client";

import {
  THEME_PREFERENCE_CHANGE_EVENT,
  applySystemThemeDom,
} from "@/lib/preferences/apply-theme-dom";
import { readStoredThemePreference } from "@/lib/preferences/read-stored-theme-preference";
import { PREFERS_DARK_MEDIA_QUERY } from "@/lib/preferences/resolve-theme";
import { THEME_STORAGE_KEY } from "@/lib/preferences/theme-cookie";
import { useEffect } from "react";

/** Follow OS theme changes while stored preference is `system` (Auto). */
export function ThemeSystemListener() {
  useEffect(() => {
    const media = window.matchMedia(PREFERS_DARK_MEDIA_QUERY);

    const syncSystemTheme = () => {
      const preference = readStoredThemePreference() ?? "system";
      if (preference !== "system") return;
      applySystemThemeDom();
    };

    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) {
        syncSystemTheme();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, syncSystemTheme);

    return () => {
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_PREFERENCE_CHANGE_EVENT, syncSystemTheme);
    };
  }, []);

  return null;
}
