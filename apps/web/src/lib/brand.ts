/** Single source of truth for marketing / SEO branding (SRP). */

export const SITE_NAME = "LAX.BID";
export const SITE_SHORT_NAME = "LAX.BID";
export const SITE_COMPANY_NAME = "London Art Exchange";
export const SITE_LEGAL_NAME = "London Auction Xchange LTD";
export const SITE_SEO_NAME = `${SITE_NAME} by ${SITE_COMPANY_NAME}`;
export const SITE_ALTERNATE_NAMES = ["LAX", SITE_COMPANY_NAME, SITE_SEO_NAME] as const;
export const SITE_TAGLINE =
  "The dedicated auction platform of London Art Exchange for fine art, rare collectibles, and culturally significant assets.";
export const SITE_CONTACT_EMAIL = "info@lax.bid";
export const SITE_SUPPORT_EMAIL = "support@lax.bid";
export const SITE_PRESS_EMAIL = "pr@lax.bid";
export const SITE_CONSIGNMENT_EMAIL = "consignment@lax.bid";
export const SITE_COMPLAINTS_EMAIL = "complaints@lax.bid";
export const SITE_TELEPHONE_DISPLAY = "0800 208 4800";
export const SITE_TELEPHONE_HREF = "08002084800";
export const SITE_TELEPHONE_SCHEMA = "+44-800-208-4800";
export const SITE_BUSINESS_ADDRESS = {
  streetAddress: "156 New Cavendish Street",
  addressLocality: "London",
  addressRegion: "Marylebone",
  postalCode: "W1W 6YW",
  addressCountry: "GB",
} as const;
export const SITE_BUSINESS_ADDRESS_LINES = [
  SITE_COMPANY_NAME,
  "156 New Cavendish Street",
  "Marylebone",
  "London W1W 6YW",
  "United Kingdom",
] as const;
export const SITE_BUSINESS_ADDRESS_INLINE =
  "156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom.";
export const SITE_BUSINESS_HOURS_LABEL = "Weekdays, 09:00 - 18:00 GMT (viewings by appointment).";
export const SITE_BUYERS_PREMIUM_STANDARD = "15%";
export const SITE_BUYERS_PREMIUM_THRESHOLD = "£500,000";
export const SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD = "10%";
export const SITE_UK_VAT_RATE = "20%";
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
