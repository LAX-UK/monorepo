"use client";
import { useConsent } from "@/lib/analytics/consent/context";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { readCookie } from "@auction/ui/lib/read-cookie";
import { useEffect, useRef } from "react";

import { syncMarketingClickIds } from "@/lib/data/http/marketing-click-ids.client";

function readClickId(name: string): string | undefined {
  return readCookie(document.cookie, name) || undefined;
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
      const fbp = readClickId("_fbp");
      const fbc = readClickId("_fbc");
      if (!fbp && !fbc) return;
      sent.current = true;
      syncMarketingClickIds({ fbp, fbc });
    }, 500);

    return () => window.clearTimeout(t);
  }, [snapshot?.marketing]);

  return null;
}
