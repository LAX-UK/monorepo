"use client";

import { useEffect } from "react";
import type { MarketingPromptSession } from "./types";

export const MARKETING_PROMPT_DWELL_TICK_MS = 1_000;

export function useMarketingPromptDwell({
  enabled,
  storageReady,
  updateSession,
}: {
  enabled: boolean;
  storageReady: boolean;
  updateSession: (updater: (current: MarketingPromptSession) => MarketingPromptSession) => void;
}): void {
  useEffect(() => {
    if (!storageReady || !enabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      updateSession((current) => ({
        ...current,
        activeDwellMs: current.activeDwellMs + MARKETING_PROMPT_DWELL_TICK_MS,
      }));
    }, MARKETING_PROMPT_DWELL_TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, storageReady, updateSession]);
}
