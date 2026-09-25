"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { clearHostedReauthLoopGuard } from "@/lib/auth/step-up/use-step-up-coordinator";
import { runHostedPostLoginEffects } from "@/lib/bff/post-login-effects.client";
import { useEffect, useRef } from "react";

/** Fires post-hosted-login side effects once after the Bid BFF callback. */
export function HostedLoginSync({
  entryIntent,
  onEffectsReady,
}: {
  entryIntent?: string | null;
  onEffectsReady?: () => void;
}) {
  const { snapshot } = useConsent();
  const intentRef = useRef<string | null>(entryIntent ?? null);
  const urlCleaned = useRef(false);
  const broadcastDone = useRef(false);
  const analyticsDone = useRef(false);

  useEffect(() => {
    if (urlCleaned.current) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("auth_fresh") !== "1") return;
    intentRef.current = query.get("entry_intent") ?? intentRef.current;
    if (intentRef.current === "reauth") {
      clearHostedReauthLoopGuard();
    }
    query.delete("auth_fresh");
    query.delete("entry_intent");
    const encoded = query.toString();
    window.history.replaceState(
      null,
      "",
      encoded ? `${window.location.pathname}?${encoded}` : window.location.pathname,
    );
    urlCleaned.current = true;
  }, []);

  useEffect(() => {
    if (!urlCleaned.current || broadcastDone.current) return;
    broadcastDone.current = true;
    runHostedPostLoginEffects({
      entryIntent: intentRef.current,
      analyticsEnabled: false,
      marketingEnabled: false,
      broadcastOnly: true,
    });
    onEffectsReady?.();
  }, [onEffectsReady]);

  useEffect(() => {
    if (!urlCleaned.current || analyticsDone.current) return;
    if (snapshot == null) return;
    analyticsDone.current = true;
    runHostedPostLoginEffects({
      entryIntent: intentRef.current,
      analyticsEnabled: snapshot.analytics === true,
      marketingEnabled: snapshot.marketing === true,
      analyticsOnly: true,
    });
  }, [snapshot]);

  useEffect(() => {
    if (!urlCleaned.current || analyticsDone.current) return;
    const timer = window.setTimeout(() => {
      if (analyticsDone.current) return;
      analyticsDone.current = true;
      runHostedPostLoginEffects({
        entryIntent: intentRef.current,
        analyticsEnabled: snapshot?.analytics === true,
        marketingEnabled: snapshot?.marketing === true,
        analyticsOnly: true,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  return null;
}
