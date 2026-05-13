"use client";

import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import type { ThemePreference } from "@/lib/preferences/theme-cookie";
import { useEffect } from "react";

type Props = { theme: ThemePreference };

/** Sync `lax_theme` + `<html class="dark">` from the session profile. RSC layouts cannot call `cookies().set()`. */
export function DashboardThemeSync({ theme }: Props) {
  useEffect(() => {
    applyThemeDom(theme);
  }, [theme]);
  return null;
}
