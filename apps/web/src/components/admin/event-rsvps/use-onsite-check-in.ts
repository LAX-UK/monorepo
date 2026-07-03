"use client";

import {
  checkInOnsiteEventGuest,
  fetchOnsiteEventCheckInStats,
  setOnsiteEventCheckInDryRun,
} from "@/lib/data/http/onsite-event-check-in.client";
import type { OnsiteEventCheckInResult } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkInInputKey,
  shouldDebounceSuccessfulScan,
  shouldSuppressRepeatScan,
} from "./check-in-scan-debounce";

type Stats = {
  total: number;
  checkedIn: number;
  checkInDryRun: boolean;
};

export function useOnsiteCheckIn(slug: string) {
  const [stats, setStats] = useState<Stats>({ total: 0, checkedIn: 0, checkInDryRun: false });
  const [statsError, setStatsError] = useState<string | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunConfirmOpen, setDryRunConfirmOpen] = useState(false);
  const [result, setResult] = useState<OnsiteEventCheckInResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const lastScanKeyRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);
  const lastScanStatusRef = useRef<OnsiteEventCheckInResult["status"] | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const next = await fetchOnsiteEventCheckInStats(slug);
      setStats(next);
      setStatsError(null);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "Could not load arrival stats");
    }
  }, [slug]);

  const runCheckIn = useCallback(
    async (input: { token?: string; rsvpId?: string }) => {
      if (busyRef.current) return null;

      const inputKey = checkInInputKey(input);
      if (
        shouldSuppressRepeatScan({
          inputKey,
          lastKey: lastScanKeyRef.current,
          lastAt: lastScanAtRef.current,
          lastStatus: lastScanStatusRef.current,
        })
      ) {
        return null;
      }

      busyRef.current = true;
      setBusy(true);
      setNetworkError(null);
      setResult(null);
      try {
        const next = await checkInOnsiteEventGuest(slug, input);
        setResult(next);
        if (inputKey) {
          lastScanKeyRef.current = inputKey;
          lastScanAtRef.current = Date.now();
          lastScanStatusRef.current = shouldDebounceSuccessfulScan(next.status)
            ? next.status
            : next.status === "INVALID" || next.status === "WRONG_EVENT"
              ? next.status
              : null;
        }
        if (next.status === "VALID" || next.status === "DRY_RUN_VALID") {
          await refreshStats();
        }
        return next;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Check-in failed";
        setNetworkError(
          message.includes("401")
            ? "Your session may have expired. Sign in again and return to this page."
            : message,
        );
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refreshStats, slug],
  );

  const enableDryRun = useCallback(() => {
    setDryRunBusy(true);
    setDryRunError(null);
    void setOnsiteEventCheckInDryRun(slug, true)
      .then((enabled) => setStats((prev) => ({ ...prev, checkInDryRun: enabled })))
      .catch((e) => {
        setDryRunError(e instanceof Error ? e.message : "Could not update dry-run mode");
      })
      .finally(() => setDryRunBusy(false));
  }, [slug]);

  const disableDryRun = useCallback(() => {
    setDryRunBusy(true);
    setDryRunError(null);
    void setOnsiteEventCheckInDryRun(slug, false)
      .then((enabled) => setStats((prev) => ({ ...prev, checkInDryRun: enabled })))
      .catch((e) => {
        setDryRunError(e instanceof Error ? e.message : "Could not update dry-run mode");
      })
      .finally(() => {
        setDryRunBusy(false);
        setDryRunConfirmOpen(false);
      });
  }, [slug]);

  useEffect(() => {
    void refreshStats();
    const timer = window.setInterval(() => {
      void refreshStats();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [refreshStats]);

  return {
    stats,
    statsError,
    dryRunBusy,
    dryRunError,
    dryRunConfirmOpen,
    setDryRunConfirmOpen,
    result,
    networkError,
    busy,
    busyRef,
    refreshStats,
    runCheckIn,
    enableDryRun,
    disableDryRun,
  };
}
