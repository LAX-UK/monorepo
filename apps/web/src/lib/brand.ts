/** Single source of truth for marketing / SEO branding (SRP). */

export const SITE_NAME = "LAX London Auction House Ltd";
export const SITE_SHORT_NAME = "LAX";
export const SITE_TAGLINE = "Fine art auctions in London — curated lots and live bidding.";
/** Legal entity name for copyright — aligned with `SITE_NAME` for public-facing consistency. */
export const SITE_LEGAL_NAME = SITE_NAME;

/** Static mark in `apps/web/public/` */
export const SITE_LOGO_PATH = "/logo.svg";
/** Vector wordmark for dark UI (header/footer/auth); light mode uses `SITE_LOGO_PATH`. */
export const SITE_LOGO_PATH_DARK = "/logo-dark.svg";

export function siteCopyrightYear(): number {
  return new Date().getFullYear();
}

export function siteCopyrightLine(): string {
  return `© ${siteCopyrightYear()} ${SITE_LEGAL_NAME}. All rights reserved.`;
}
