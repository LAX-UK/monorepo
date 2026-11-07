"use client";

import { HostedLoginSync } from "@/components/analytics/hosted-login-sync";
import { useCallback, useEffect, useRef } from "react";

const EFFECTS_WAIT_MS = 400;

export function PostLoginHandoff({
  destination,
  entryIntent,
}: {
  destination: string;
  entryIntent?: string | null;
}) {
  const navigated = useRef(false);

  const navigate = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    // A page load, not a router navigation: signing in is the start of a session, and the first
    // client-area page must come with the cookies the sign-in set, in a layout of its own.
    window.location.replace(destination);
  }, [destination]);

  useEffect(() => {
    const timer = window.setTimeout(navigate, EFFECTS_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return <HostedLoginSync entryIntent={entryIntent ?? null} onEffectsReady={navigate} />;
}
