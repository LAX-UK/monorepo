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
  clearAttributionCookieServer,
  persistAttributionCookieServer,
} from "@/lib/analytics/persist-attribution-cookie.server";
import {
  deleteMarketingAttribution,
  syncMarketingAttribution,
} from "@/lib/data/http/marketing-attribution.client";
import type { MarketingAttributionTouch } from "@auction/types";
import { mergeAttributionSnapshot } from "@auction/validators";
import { useCallback, useEffect, useRef } from "react";

const RETRY_DELAYS_MS = [0, 1_000, 5_000] as const;

async function retryRequest(operation: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Capture UTMs on first paint; persist + sync when marketing consent is granted. */
export function MarketingAttributionSync() {
  const { snapshot } = useConsent();
  const pendingTouch = useRef<MarketingAttributionTouch | null>(null);
  const initialDocumentCaptured = useRef(false);
  const cookieMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const cookiePersistInFlight = useRef<string | null>(null);
  const attributionMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const persistedCookie = useRef<string | null>(null);
  const syncedSnapshot = useRef<string | null>(null);
  const syncInFlight = useRef<string | null>(null);
  const marketingWasGranted = useRef(false);
  const withdrawalHandled = useRef(false);
  const withdrawalInFlight = useRef(false);

  const queueCookieMutation = useCallback((operation: () => Promise<void>): Promise<void> => {
    const next = cookieMutationQueue.current
      .catch(() => undefined)
      .then(() => retryRequest(operation));
    cookieMutationQueue.current = next;
    return next;
  }, []);

  const queueAttributionMutation = useCallback((operation: () => Promise<void>): Promise<void> => {
    const next = attributionMutationQueue.current
      .catch(() => undefined)
      .then(() => retryRequest(operation));
    attributionMutationQueue.current = next;
    return next;
  }, []);

  useEffect(() => {
    const enabled = isMarketingAttributionEnabled();

    const withdraw = (): void => {
      const hadStoredAttribution = readAttributionCookie() !== null;
      clearAttributionCookie();
      cookiePersistInFlight.current = null;
      void queueCookieMutation(clearAttributionCookieServer)
        .then(() => {
          persistedCookie.current = null;
        })
        .catch(() => undefined);
      syncedSnapshot.current = null;
      persistedCookie.current = null;
      syncInFlight.current = null;
      const shouldDeleteServerCopy =
        snapshot !== null || marketingWasGranted.current || hadStoredAttribution;
      marketingWasGranted.current = false;
      if (shouldDeleteServerCopy && !withdrawalHandled.current && !withdrawalInFlight.current) {
        withdrawalInFlight.current = true;
        void queueAttributionMutation(deleteMarketingAttribution)
          .then(() => {
            if (!marketingWasGranted.current) withdrawalHandled.current = true;
          })
          .catch(() => undefined)
          .finally(() => {
            withdrawalInFlight.current = false;
          });
      }
    };

    if (!enabled) {
      withdraw();
      return;
    }

    if (!initialDocumentCaptured.current) {
      pendingTouch.current = captureInitialDocumentTouch();
      initialDocumentCaptured.current = true;
    }

    const marketing = snapshot?.marketing === true;
    if (!marketing) {
      withdraw();
      return;
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
    if (persistedCookie.current !== serialized && cookiePersistInFlight.current !== serialized) {
      cookiePersistInFlight.current = serialized;
      void queueCookieMutation(() => persistAttributionCookieServer(attribution))
        .then(() => {
          if (cookiePersistInFlight.current === serialized) {
            persistedCookie.current = serialized;
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (cookiePersistInFlight.current === serialized) {
            cookiePersistInFlight.current = null;
          }
        });
    }
    if (syncedSnapshot.current === serialized || syncInFlight.current === serialized) return;

    syncInFlight.current = serialized;
    void queueAttributionMutation(() => syncMarketingAttribution(attribution))
      .then(() => {
        if (syncInFlight.current === serialized) {
          syncedSnapshot.current = serialized;
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (syncInFlight.current === serialized) syncInFlight.current = null;
      });
  }, [queueAttributionMutation, queueCookieMutation, snapshot?.marketing, snapshot]);

  return null;
}
