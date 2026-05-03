/** Single source of truth for marketing / SEO branding (SRP). */

export const SITE_NAME = "LAX London Auction House Ltd";
export const SITE_SHORT_NAME = "LAX";
export const SITE_TAGLINE = "Fine art auctions in London — curated lots and live bidding.";
/** Legal entity name for copyright — aligned with `SITE_NAME` for public-facing consistency. */
export const SITE_LEGAL_NAME = SITE_NAME;
export const SITE_CONTACT_EMAIL = "concierge@laxauction.house";
export const SITE_TELEPHONE_DISPLAY = "+44 20 7946 0958";
export const SITE_TELEPHONE_HREF = "+442079460958";
export const SITE_TELEPHONE_SCHEMA = "+44-20-7946-0958";
export const SITE_BUSINESS_ADDRESS = {
  streetAddress: "1 Curator Mews",
  addressLocality: "London",
  postalCode: "W1K 1AA",
  addressCountry: "GB",
} as const;
export const SITE_BUSINESS_ADDRESS_INLINE = "1 Curator Mews, London W1K 1AA, United Kingdom.";
export const SITE_BUSINESS_HOURS_LABEL =
  "Monday – Friday, 09:00 – 18:00 (viewings by appointment).";
export const SITE_THEME_COLOR_LIGHT = "#f1f1f3";
export const SITE_THEME_COLOR_DARK = "#121414";

/** Static mark in `apps/web/public/` */
export const SITE_LOGO_PATH = "/logo.svg";
/** Compact mark for narrow chrome (e.g. collapsed dashboard sidebar). */
export const SITE_LOGO_SHORT_PATH = "/logo-short.svg";

export function siteCopyrightYear(): number {
  return new Date().getFullYear();
}

export function siteCopyrightLine(): string {
  return `© ${siteCopyrightYear()} ${SITE_LEGAL_NAME}. All rights reserved.`;
}
