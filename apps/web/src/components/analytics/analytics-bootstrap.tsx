"use client";

import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { gtmScriptSrc } from "@/lib/analytics/providers/gtm";
import Script from "next/script";

type Props = {
  /** CSP nonce from middleware (`x-nonce`) for the external GTM script. */
  nonce: string;
};

/** Loads `gtm.js` in production (advanced Consent Mode: tags respect denied defaults + cookieless pings). */
export function AnalyticsBootstrap({ nonce }: Props) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

  const loadGtm = isAnalyticsEnabled() && gtmId.length > 0;

  if (!gtmId) return null;

  return loadGtm ? (
    <Script
      id="gtm-loader"
      strategy="afterInteractive"
      {...(nonce ? { nonce } : {})}
      src={gtmScriptSrc(gtmId)}
    />
  ) : null;
}
