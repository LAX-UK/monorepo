"use client";

import type { AppearanceOptions } from "@stripe/connect-js";
import { useEffect, useState } from "react";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildAppearance(): AppearanceOptions {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return {
    overlays: "dialog",
    variables: {
      colorPrimary: readCssVar("--color-primary", isDark ? "#f2f1df" : "#000000"),
      colorBackground: readCssVar(
        isDark ? "--color-surface-container" : "--color-page-bg",
        isDark ? "#1a1614" : "#ffffff",
      ),
      colorText: readCssVar("--color-on-surface", isDark ? "#f2f1df" : "#1a1614"),
      colorDanger: readCssVar("--color-error", "#b3261e"),
      fontFamily: "var(--font-body, system-ui, sans-serif)",
      borderRadius: "8px",
    },
  };
}

/** Theme-aware Stripe Connect appearance derived from LAX CSS variables. */
export function useConnectAppearance(): AppearanceOptions {
  const [appearance, setAppearance] = useState<AppearanceOptions>(() => buildAppearance());

  useEffect(() => {
    const refresh = () => setAppearance(buildAppearance());
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return appearance;
}
