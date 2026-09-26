"use client";

import { trackSilentSignInResult } from "@/lib/analytics/events";
import { useEffect } from "react";

const GUEST_RESULT_COOKIE = "bid_sso_result";

/** Reads redirect-strategy guest outcome set by the silent OIDC callback. */
export function SilentSignInResultEmitter() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)bid_sso_result=guest(?:;|$)/);
    if (!match) return;
    document.cookie = `${GUEST_RESULT_COOKIE}=; Max-Age=0; path=/`;
    trackSilentSignInResult({ strategy: "redirect", outcome: "guest" });
  }, []);

  return null;
}
