"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { isMarketingAttributionEnabled } from "@/lib/analytics/is-marketing-attribution-enabled";
import {
  captureInitialDocumentTouch,
  clearAttributionCookie,
  readAttributionCookie,
  writeAttributionCookie,
} from "@/lib/analytics/marketing-attribution-cookie";
import {
  deleteMarketingAttribution,
  syncMarketingAttribution,
} from "@/lib/data/http/marketing-attribution.client";
import type { MarketingAttributionTouch } from "@auction/types";
import { mergeAttributionSnapshot } from "@auction/validators";
import { useEffect, useRef } from "react";

const RETRY_DELAYS_MS = [0, 1_000, 5_000] as const;

/** Capture UTMs on first paint; persist + sync when marketing consent is granted. */
export function MarketingAttributionSync() {
  const { snapshot } = useConsent();
  const pendingTouch = useRef<MarketingAttributionTouch | null>(null);
  const initialDocumentCaptured = useRef(false);
  const syncedSnapshot = useRef<string | null>(null);
  const syncInFlight = useRef<string | null>(null);
  const marketingWasGranted = useRef(false);
  const withdrawalHandled = useRef(false);
  const withdrawalInFlight = useRef(false);

  useEffect(() => {
    const enabled = isMarketingAttributionEnabled();
    const timers = new Set<number>();
    let cancelled = false;

    const retry = (operation: () => Promise<void>, onSuccess: () => void): void => {
      const attempt = (index: number): void => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          void operation()
            .then(() => {
              if (!cancelled) onSuccess();
            })
            .catch(() => {
              if (!cancelled && index + 1 < RETRY_DELAYS_MS.length) {
                attempt(index + 1);
              }
            });
        }, RETRY_DELAYS_MS[index]);
        timers.add(timer);
      };
      attempt(0);
    };

    const cleanup = (): void => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
      withdrawalInFlight.current = false;
    };

    const withdraw = (): void => {
      const hadStoredAttribution = readAttributionCookie() !== null;
      clearAttributionCookie();
      syncedSnapshot.current = null;
      syncInFlight.current = null;
      const shouldDeleteServerCopy = marketingWasGranted.current || hadStoredAttribution;
      marketingWasGranted.current = false;
      if (shouldDeleteServerCopy && !withdrawalHandled.current && !withdrawalInFlight.current) {
        withdrawalInFlight.current = true;
        retry(deleteMarketingAttribution, () => {
          withdrawalHandled.current = true;
          withdrawalInFlight.current = false;
        });
      }
    };

    if (!enabled) {
      withdraw();
      return cleanup;
    }

    if (!initialDocumentCaptured.current) {
      pendingTouch.current = captureInitialDocumentTouch();
      initialDocumentCaptured.current = true;
    }

    const marketing = snapshot?.marketing === true;
    if (!marketing) {
      withdraw();
      return cleanup;
    }

    marketingWasGranted.current = true;
    withdrawalHandled.current = false;
    const existing = readAttributionCookie();
    const attribution = pendingTouch.current
      ? mergeAttributionSnapshot(existing, pendingTouch.current)
      : existing;
    if (!attribution) return;

    writeAttributionCookie(attribution);
    const serialized = JSON.stringify(attribution);
    if (syncedSnapshot.current === serialized || syncInFlight.current === serialized) return;

    syncInFlight.current = serialized;
    retry(
      () => syncMarketingAttribution(attribution),
      () => {
        syncedSnapshot.current = serialized;
        syncInFlight.current = null;
      },
    );

    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
      if (syncInFlight.current === serialized) syncInFlight.current = null;
    };
  }, [snapshot?.marketing, snapshot]);

  return null;
}
