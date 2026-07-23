/** Versioned first/last campaign attribution snapshot (lean model). */

export const MARKETING_ATTRIBUTION_VERSION = 1 as const;

export type MarketingAttributionVersion = typeof MARKETING_ATTRIBUTION_VERSION;

/** Single campaign landing capture (GA4 manual + common click ids). */
export type MarketingAttributionTouch = {
  capturedAt: string;
  landingPath: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmId?: string;
  utmTerm?: string;
  utmContent?: string;
  utmSourcePlatform?: string;
  utmCreativeFormat?: string;
  utmMarketingTactic?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
};

export type MarketingAttributionSnapshot = {
  version: MarketingAttributionVersion;
  firstTouch?: MarketingAttributionTouch;
  lastTouch?: MarketingAttributionTouch;
};
