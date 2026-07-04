"use client";

import { readConsentFromDocument } from "@/lib/analytics/consent-headers";
import { useConsent } from "@/lib/analytics/consent/context";
import { trackPageView } from "@/lib/analytics/events";
import { pingGtmHealth } from "@/lib/analytics/gtm-health.client";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { Button } from "@auction/ui/components/button";
import { useEffect, useMemo, useState } from "react";

type Row = { label: string; value: string; ok: boolean | null };

function readRows(gtmId: string, analytics: boolean): Row[] {
  const gtmScript = document.getElementById("gtm-loader");
  const gtmLoaded =
    typeof (window as Window & { google_tag_manager?: unknown }).google_tag_manager !== "undefined";
  const dl = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  const dlLen = Array.isArray(dl) ? dl.length : 0;

  return [
    {
      label: "Analytics enabled (prod + GTM id)",
      value: isAnalyticsEnabled() ? "yes" : "no",
      ok: isAnalyticsEnabled(),
    },
    {
      label: "NEXT_PUBLIC_GTM_ID",
      value: gtmId || "(empty — rebuild needed)",
      ok: gtmId.length > 0,
    },
    {
      label: "Consent analytics",
      value: analytics ? "granted" : "denied / no choice",
      ok: analytics,
    },
    {
      label: "gtm.js script tag (#gtm-loader)",
      value: gtmScript ? "present" : "missing",
      ok: Boolean(gtmScript),
    },
    {
      label: "google_tag_manager global",
      value: gtmLoaded ? "loaded" : "not loaded",
      ok: gtmLoaded,
    },
    {
      label: "dataLayer entries",
      value: String(dlLen),
      ok: dlLen > 0 ? true : null,
    },
  ];
}

/** On-screen checklist when `?lax_analytics_debug=1` is in the URL. */
export function AnalyticsDebugPanel() {
  const { snapshot } = useConsent();
  const analytics = snapshot?.analytics === true;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [networkHint, setNetworkHint] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.has("lax_analytics_debug"));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRows(readRows(gtmId, analytics));
    refresh();
    const id = window.setInterval(refresh, 1500);
    return () => window.clearInterval(id);
  }, [enabled, gtmId, analytics]);

  const cookieRaw = useMemo(() => {
    if (!enabled) return "";
    const c = readConsentFromDocument();
    return c ? JSON.stringify(c) : "(no lax_consent cookie readable)";
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      aria-label="Analytics debug"
      className="fixed bottom-4 right-4 z-[9999] max-w-md rounded-lg border border-outline-variant bg-surface-container-high p-4 font-mono text-xs text-on-surface shadow-lg"
    >
      <p className="mb-2 font-sans text-sm font-semibold">Analytics debug</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-2">
            <span className="text-on-surface-variant">{r.label}</span>
            <span
              className={
                r.ok === true
                  ? "text-green-700 dark:text-green-400"
                  : r.ok === false
                    ? "text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
              }
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 break-all text-on-surface-variant">cookie: {cookieRaw}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          className="h-auto min-h-0 rounded px-2 py-1 font-sans text-xs"
          onClick={() => {
            trackPageView(window.location.pathname);
            setNetworkHint(
              "Pushed page_view — check Network for gtm.lax.bid or google-analytics.com",
            );
          }}
        >
          Push test page_view
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-0 rounded px-2 py-1 font-sans text-xs"
          onClick={() => {
            void pingGtmHealth().then(setNetworkHint);
          }}
        >
          Ping gtm.lax.bid
        </Button>
      </div>
      {networkHint ? <p className="mt-2 text-on-surface-variant">{networkHint}</p> : null}
      <p className="mt-2 font-sans text-[10px] leading-snug text-on-surface-variant">
        Network: filter <code>gtm.lax.bid</code> OR <code>google-analytics</code>. No hits anywhere
        → GTM not firing. Hits on google-analytics.com only → server_container_url missing in web
        GTM.
      </p>
    </aside>
  );
}
