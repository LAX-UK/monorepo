/** Acting legal entity for multi-entity buyers (browser + server). */
export const X_LEGAL_ENTITY_ID_HEADER = "x-legal-entity-id";

/** Marketing consent forwarded from the browser cookie banner. */
export const MARKETING_CONSENT_MARKETING_HEADER = "x-lax-consent-marketing";
export const MARKETING_CONSENT_ANALYTICS_HEADER = "x-lax-consent-analytics";

/** Sanitized page URL for marketing attribution (browser only). */
export const MARKETING_PAGE_URL_HEADER = "x-lax-page-url";

/** JSON snapshot of first/last campaign attribution (browser, marketing consent). */
export const MARKETING_ATTRIBUTION_HEADER = "x-lax-attribution";

/**
 * Custom headers the browser client may send on credentialed API calls.
 * Keep in sync with Hono CORS `allowHeaders` in apps/api.
 */
export const BROWSER_API_CUSTOM_HEADERS = [
  "Content-Type",
  "Authorization",
  "Idempotency-Key",
  MARKETING_CONSENT_MARKETING_HEADER,
  MARKETING_CONSENT_ANALYTICS_HEADER,
  MARKETING_PAGE_URL_HEADER,
  MARKETING_ATTRIBUTION_HEADER,
  X_LEGAL_ENTITY_ID_HEADER,
] as const;
