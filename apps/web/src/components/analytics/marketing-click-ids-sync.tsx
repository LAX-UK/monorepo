"use client";

import { marketingConsentHeaderValues } from "@/lib/analytics/consent-headers";
import { useConsent } from "@/lib/analytics/consent/context";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { useEffect, useRef } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** After marketing consent, POST _fbp/_fbc once per session for server-side CAPI enrichment. */
export function MarketingClickIdsSync() {
  const { snapshot } = useConsent();
  const sent = useRef(false);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    if (!snapshot?.marketing) return;
    if (sent.current) return;

    const t = window.setTimeout(() => {
      const fbp = readCookie("_fbp");
      const fbc = readCookie("_fbc");
      if (!fbp && !fbc) return;
      sent.current = true;
      void fetch(`${apiBase()}/marketing/click-ids`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...marketingConsentHeaderValues(),
        },
        body: JSON.stringify({ fbp, fbc }),
      }).catch(() => {
        sent.current = false;
      });
    }, 500);

    return () => window.clearTimeout(t);
  }, [snapshot?.marketing]);

  return null;
}
