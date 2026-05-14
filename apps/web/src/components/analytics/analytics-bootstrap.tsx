"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { gtmScriptSrc } from "@/lib/analytics/providers/gtm";
import Script from "next/script";

type Props = {
  /** CSP nonce from middleware (`x-nonce`) for the external GTM script. */
  nonce: string;
};

/** Loads `gtm.js` only in production with `NEXT_PUBLIC_GTM_ID` and analytics consent. */
export function AnalyticsBootstrap({ nonce }: Props) {
  const { snapshot } = useConsent();
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

  const loadGtm =
    isAnalyticsEnabled() && gtmId.length > 0 && snapshot !== null && snapshot.analytics === true;

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
