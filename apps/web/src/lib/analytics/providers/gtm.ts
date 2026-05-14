import type { ConsentSnapshot } from "@/lib/analytics/consent/cookie";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import type { AnalyticsProvider, TrackPayload } from "@/lib/analytics/provider";

type DataLayerArg = Record<string, unknown> | unknown[];

type GtagWindow = Window & {
  dataLayer?: DataLayerArg[];
  gtag?: (...args: unknown[]) => void;
};

function ensureGtag(w: GtagWindow): void {
  w.dataLayer = w.dataLayer ?? [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer?.push(args);
    };
  }
}

function consentState(granted: boolean): "granted" | "denied" {
  return granted ? "granted" : "denied";
}

/** Consent Mode v2 map from our snapshot (null = no choice yet → all denied except security). */
function consentUpdateFromSnapshot(snapshot: ConsentSnapshot | null) {
  const analytics = snapshot?.analytics ?? false;
  const marketing = snapshot?.marketing ?? false;
  return {
    analytics_storage: consentState(analytics),
    ad_storage: consentState(marketing),
    ad_user_data: consentState(marketing),
    ad_personalization: consentState(marketing),
    personalization_storage: consentState(marketing),
    functionality_storage: consentState(analytics || marketing),
    security_storage: "granted" as const,
  };
}

export function createGtmAnalyticsProvider(_gtmId: string): AnalyticsProvider {
  return {
    id: "gtm",

    pushConsentDefault() {
      if (typeof window === "undefined") return;
      if (!isAnalyticsEnabled()) return;
      const w = window as GtagWindow;
      ensureGtag(w);
      w.gtag?.("consent", "default", consentUpdateFromSnapshot(null));
    },

    updateConsent(snapshot: ConsentSnapshot | null) {
      if (typeof window === "undefined") return;
      if (!isAnalyticsEnabled()) return;
      const w = window as GtagWindow;
      ensureGtag(w);
      w.gtag?.("consent", "update", consentUpdateFromSnapshot(snapshot));
    },

    track(payload: TrackPayload) {
      if (typeof window === "undefined") return;
      if (!isAnalyticsEnabled()) return;
      const w = window as GtagWindow;
      w.dataLayer = w.dataLayer ?? [];
      w.dataLayer.push({
        event: payload.name,
        ...(payload.params ?? {}),
      });
    },
  };
}

/** Public GTM loader URL (container id only, no PII). */
export function gtmScriptSrc(gtmId: string): string {
  const trimmed = gtmId.trim();
  const id = trimmed.toUpperCase().startsWith("GTM-") ? trimmed : `GTM-${trimmed}`;
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
}

/** GTM iframe fallback URL for `<noscript>`. */
export function gtmNoscriptSrc(gtmId: string): string {
  const trimmed = gtmId.trim();
  const id = trimmed.toUpperCase().startsWith("GTM-") ? trimmed : `GTM-${trimmed}`;
  return `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`;
}
