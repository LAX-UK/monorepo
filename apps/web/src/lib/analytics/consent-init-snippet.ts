import type { ConsentSnapshot } from "@/lib/analytics/consent/cookie";

function consentMap(snapshot: ConsentSnapshot | null) {
  const analytics = snapshot?.analytics ?? false;
  const marketing = snapshot?.marketing ?? false;
  const state = (granted: boolean) => (granted ? "granted" : "denied");
  return {
    analytics_storage: state(analytics),
    ad_storage: state(marketing),
    ad_user_data: state(marketing),
    ad_personalization: state(marketing),
    personalization_storage: state(marketing),
    functionality_storage: state(analytics || marketing),
    security_storage: "granted",
  };
}

/**
 * Inline head snippet: Consent Mode default (denied) plus an immediate update when
 * the SSR cookie already records a choice. Must run synchronously before gtm.js.
 */
export function buildConsentInitSnippet(snapshot: ConsentSnapshot | null): string {
  const denied = consentMap(null);
  const update = snapshot ? consentMap(snapshot) : null;
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    `gtag('consent','default',${JSON.stringify(denied)});`,
    "gtag('set','url_passthrough',true);",
    "gtag('set','ads_data_redaction',true);",
    ...(update ? [`gtag('consent','update',${JSON.stringify(update)});`] : []),
  ].join("");
}
