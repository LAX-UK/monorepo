/** Single source of truth for marketing / SEO branding (SRP). */

export const SITE_NAME = "LAX London Auction House Ltd";
export const SITE_SHORT_NAME = "LAX";
export const SITE_TAGLINE = "Fine art auctions in London — curated lots and live bidding.";
export const SITE_LEGAL_NAME = "Lax Limited Auction House Ltd";

/** Static mark in `apps/web/public/` */
export const SITE_LOGO_PATH = "/logo.svg";

export function siteCopyrightYear(): number {
  return new Date().getFullYear();
}

export function siteCopyrightLine(): string {
  return `© ${siteCopyrightYear()} ${SITE_LEGAL_NAME}. All rights reserved.`;
}
