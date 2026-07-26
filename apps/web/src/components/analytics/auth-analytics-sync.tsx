"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { trackLogin, trackSignUp } from "@/lib/analytics/events";
import { type OAuthProvider, parseOAuthProvider } from "@/lib/auth/oauth-return-params";
import { resolveOAuthOutcome } from "@/lib/data/http/marketing-oauth-outcome.client";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const RETRY_DELAYS_MS = [0, 1_000, 5_000] as const;

function stripOAuthMarker(): void {
  const query = new URLSearchParams(window.location.search);
  if (!query.has("oauth_provider")) return;
  query.delete("oauth_provider");
  const encoded = query.toString();
  window.history.replaceState(
    null,
    "",
    encoded ? `${window.location.pathname}?${encoded}` : window.location.pathname,
  );
}

/** Resolve the actual OAuth outcome server-side, then emit one consented GA4 event. */
export function AuthAnalyticsSync() {
  const searchParams = useSearchParams();
  const { snapshot } = useConsent();
  const providerRef = useRef<OAuthProvider | null>(null);
  const completed = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!providerRef.current) {
      providerRef.current = parseOAuthProvider(searchParams.get("oauth_provider") ?? undefined);
      if (providerRef.current) stripOAuthMarker();
    }
    const provider = providerRef.current;
    if (!provider || completed.current || inFlight.current) return;
    if (snapshot?.analytics !== true || snapshot.marketing !== true) return;

    let cancelled = false;
    const timers = new Set<number>();
    inFlight.current = true;

    const attempt = (index: number): void => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        void resolveOAuthOutcome(provider)
          .then((outcome) => {
            if (cancelled) return;
            completed.current = true;
            inFlight.current = false;
            if (outcome.event === "signup") trackSignUp(outcome.method);
            if (outcome.event === "login") trackLogin(outcome.method);
          })
          .catch(() => {
            if (!cancelled && index + 1 < RETRY_DELAYS_MS.length) {
              attempt(index + 1);
              return;
            }
            inFlight.current = false;
          });
      }, RETRY_DELAYS_MS[index]);
      timers.add(timer);
    };

    attempt(0);
    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
      inFlight.current = false;
    };
  }, [searchParams, snapshot?.analytics, snapshot?.marketing]);

  return null;
}
