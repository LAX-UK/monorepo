"use client";

import { fetchAdminSaleOperationsSnapshot } from "@/lib/data/http/operations-snapshot.client";
import { RateLimitedError, mapInChunks } from "@/lib/data/http/rate-limited";
import type { SaleroomHubRowSummary } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { notify } from "@/lib/ui/notify";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 45_000;
/** Snapshots fetched at once; a long hub list would otherwise trip the API rate limit. */
const SNAPSHOT_CONCURRENCY = 3;

function pendingAttentionCount(snap: AdminSaleOperationsSnapshot | null): number {
  if (!snap) return 0;
  return (snap.registrations.pending ?? 0) + (snap.telephoneBookings.requested ?? 0);
}

export function useSaleroomHubMetricsPoll(
  saleIds: string[],
  rows: readonly SaleroomHubRowSummary[] = [],
) {
  const [snapshots, setSnapshots] = useState<Record<string, AdminSaleOperationsSnapshot | null>>(
    {},
  );
  const prevPendingRef = useRef<Record<string, number>>({});
  const initializedRef = useRef(false);
  const pausedUntilRef = useRef(0);

  const refresh = useCallback(async () => {
    if (saleIds.length === 0 || Date.now() < pausedUntilRef.current) return;
    const outcomes = await mapInChunks(saleIds, SNAPSHOT_CONCURRENCY, async (saleId) => {
      try {
        return { saleId, snap: await fetchAdminSaleOperationsSnapshot(saleId), limited: false };
      } catch (error) {
        if (error instanceof RateLimitedError) {
          pausedUntilRef.current = Date.now() + (error.retryAfterMs ?? POLL_MS);
          return { saleId, snap: null, limited: true };
        }
        return { saleId, snap: null, limited: false };
      }
    });
    // A rate-limited sale keeps the numbers already shown and is tried again after the pause.
    const results = outcomes.filter((outcome) => !outcome.limited);
    setSnapshots((prev) => {
      const next = { ...prev };
      for (const { saleId, snap } of results) {
        next[saleId] = snap;
      }
      return next;
    });

    if (!initializedRef.current) {
      for (const { saleId, snap } of results) {
        prevPendingRef.current[saleId] = pendingAttentionCount(snap);
      }
      initializedRef.current = true;
      return;
    }

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      for (const { saleId, snap } of results) {
        prevPendingRef.current[saleId] = pendingAttentionCount(snap);
      }
      return;
    }

    for (const { saleId, snap } of results) {
      const pending = pendingAttentionCount(snap);
      const prev = prevPendingRef.current[saleId] ?? 0;
      if (pending > prev) {
        const row = rows.find((r) => r.saleId === saleId);
        const title = row?.title ?? "Saleroom";
        const reg = snap?.registrations.pending ?? 0;
        const tel = snap?.telephoneBookings.requested ?? 0;
        const parts: string[] = [];
        if (reg > 0) parts.push(`${reg} reg pending`);
        if (tel > 0) parts.push(`${tel} tel pending`);
        notify.info(`${title} needs attention`, {
          id: `hub-attention-${saleId}`,
          description: parts.join(" · ") || "New pending work",
        });
      }
      prevPendingRef.current[saleId] = pending;
    }
  }, [saleIds, rows]);

  useEffect(() => {
    void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { snapshots, refresh };
}
