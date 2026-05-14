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
