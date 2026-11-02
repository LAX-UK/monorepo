/** Non-optional site operation cookies — always on; not toggled in UI. */
export const CONSENT_CATEGORY_NECESSARY = "necessary" as const;

/** Measurement (e.g. GA4 via GTM). */
export const CONSENT_CATEGORY_ANALYTICS = "analytics" as const;

/** Ads / remarketing tags inside GTM. */
export const CONSENT_CATEGORY_MARKETING = "marketing" as const;

export type ConsentCategory =
  | typeof CONSENT_CATEGORY_NECESSARY
  | typeof CONSENT_CATEGORY_ANALYTICS
  | typeof CONSENT_CATEGORY_MARKETING;

/**
 * Whether anything on the site sets marketing cookies. Marketing is offered in the consent UI,
 * and granted by "Accept all", only when a marketing tag is configured.
 */
export function isMarketingOffered(): boolean {
  return process.env.NEXT_PUBLIC_MARKETING_TAGS === "true";
}

/** What "Accept all" grants: every category the site actually offers. */
export function acceptAllPrefs(): { analytics: boolean; marketing: boolean } {
  return { analytics: true, marketing: isMarketingOffered() };
}
