"use client";

import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { readStoredThemePreference } from "@/lib/preferences/read-stored-theme-preference";
import type { ThemePreference } from "@/lib/preferences/theme-cookie";
import { useEffect } from "react";

type Props = { theme: ThemePreference | null };

/** Hydrate theme from profile when the device has no stored preference; otherwise honour device storage. */
export function SessionThemeSync({ theme }: Props) {
  useEffect(() => {
    const stored = readStoredThemePreference();
    if (stored) {
      applyThemeDom(stored);
      return;
    }
    if (theme) {
      applyThemeDom(theme);
    }
  }, [theme]);

  return null;
}
