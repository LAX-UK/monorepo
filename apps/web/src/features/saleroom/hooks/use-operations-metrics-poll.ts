"use client";

import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import {
  fetchAdminSaleOperationsSnapshot,
  fetchAdminSalePaddleRoster,
} from "@/lib/data/http/operations-snapshot.client";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 45_000;

type Args = {
  saleId: string;
  initialSnapshot: AdminSaleOperationsSnapshot;
  initialPaddleRoster: AdminPaddleRosterEntry[];
};

export function useOperationsMetricsPoll({ saleId, initialSnapshot, initialPaddleRoster }: Args): {
  snapshot: AdminSaleOperationsSnapshot;
  paddleRoster: AdminPaddleRosterEntry[];
} {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [paddleRoster, setPaddleRoster] = useState(initialPaddleRoster);
  const refreshGenerationRef = useRef(0);

  useEffect(() => {
    setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    setPaddleRoster(initialPaddleRoster);
  }, [initialPaddleRoster]);

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    try {
      const [nextSnapshot, nextRoster] = await Promise.all([
        fetchAdminSaleOperationsSnapshot(saleId),
        fetchAdminSalePaddleRoster(saleId),
      ]);
      if (generation !== refreshGenerationRef.current) return;
      if (nextSnapshot) setSnapshot(nextSnapshot);
      setPaddleRoster(nextRoster);
    } catch {
      // Keep last good values during transient failures.
    }
  }, [saleId]);

  useEffect(() => {
    void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { snapshot, paddleRoster };
}
