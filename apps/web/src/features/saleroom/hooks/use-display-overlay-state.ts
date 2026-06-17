"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  type ClerkDisplayOverlay,
  applyDisplayControlEvent,
  reconcileDisplayOverlay,
  toClerkDisplayOverlay,
} from "@/features/saleroom/lib/display-overlay-state";
import {
  type ClerkDisplayOverlayFetcher,
  fetchClerkDisplayOverlay,
} from "@/features/saleroom/lib/fetch-clerk-display-overlay";
import type { SaleroomDisplayControlPayload, SaleroomDisplayOverlay } from "@auction/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Options = {
  saleId: string;
  initialOverlay?: SaleroomDisplayOverlay | null;
  fetchOverlay?: ClerkDisplayOverlayFetcher;
  socketAdapter?: SaleroomSocketAdapter;
  pollIntervalMs?: number;
};

export function useDisplayOverlayState({
  saleId,
  initialOverlay = null,
  fetchOverlay = fetchClerkDisplayOverlay,
  socketAdapter = createSaleroomSocketAdapter(),
  pollIntervalMs = 15_000,
}: Options) {
  const [overlay, setOverlay] = useState<SaleroomDisplayOverlay | null>(initialOverlay);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const refreshOverlay = useCallback(async () => {
    try {
      const fromServer = await fetchOverlay(saleId);
      setOverlay((prev) => reconcileDisplayOverlay(prev, fromServer));
    } catch {
      /* ignore */
    }
  }, [fetchOverlay, saleId]);

  useEffect(() => {
    setOverlay(initialOverlay);
  }, [initialOverlay]);

  useEffect(() => {
    void refreshOverlay();
  }, [refreshOverlay]);

  useEffect(() => {
    const onDisplayControl = (raw: unknown) => {
      const event = raw as SaleroomDisplayControlPayload;
      if (!event || typeof event.kind !== "string") return;
      if (event.saleId && event.saleId !== saleId) return;
      setOverlay((prev) => applyDisplayControlEvent(prev, event));
    };

    socketAdapter.onDisplayControl(onDisplayControl);
    return () => {
      socketAdapter.offDisplayControl(onDisplayControl);
    };
  }, [saleId, socketAdapter]);

  useEffect(() => {
    const timer = setInterval(() => void refreshOverlay(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs, refreshOverlay]);

  const setOptimisticOverlay = useCallback((next: ClerkDisplayOverlay) => {
    setOverlay({
      kind: next.kind,
      ...(next.message ? { message: next.message } : {}),
      emittedAt: new Date().toISOString(),
    });
  }, []);

  const clearOptimisticOverlay = useCallback(() => {
    setOverlay(null);
  }, []);

  const activeOverlay = useMemo(() => toClerkDisplayOverlay(overlay), [overlay]);

  return {
    activeOverlay,
    hasActiveOverlay: activeOverlay != null,
    setOptimisticOverlay,
    clearOptimisticOverlay,
    refreshOverlay,
  };
}
