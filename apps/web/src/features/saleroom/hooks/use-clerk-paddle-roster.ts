"use client";

import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { fetchAdminSalePaddleRoster } from "@/lib/data/http/operations-snapshot.client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ClerkPaddleRosterFetcher = (saleId: string) => Promise<AdminPaddleRosterEntry[]>;

type Options = {
  saleId: string;
  initialRoster: AdminPaddleRosterEntry[];
  fetchRoster?: ClerkPaddleRosterFetcher;
  /** When set, refresh roster on an interval while the tab is visible. */
  pollIntervalMs?: number;
};

export function useClerkPaddleRoster({
  saleId,
  initialRoster,
  fetchRoster = fetchAdminSalePaddleRoster,
  pollIntervalMs,
}: Options) {
  const [roster, setRoster] = useState(initialRoster);
  const refreshGenerationRef = useRef(0);

  useEffect(() => {
    setRoster(initialRoster);
  }, [initialRoster]);

  const refreshRoster = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    try {
      const next = await fetchRoster(saleId);
      if (generation !== refreshGenerationRef.current) return next;
      setRoster(next);
      return next;
    } catch {
      // Keep last good roster during transient failures.
      return undefined;
    }
  }, [fetchRoster, saleId]);

  useEffect(() => {
    if (pollIntervalMs == null || pollIntervalMs <= 0) return;

    void refreshRoster();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshRoster();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRoster();
    }, pollIntervalMs);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [pollIntervalMs, refreshRoster]);

  return { roster, refreshRoster };
}
