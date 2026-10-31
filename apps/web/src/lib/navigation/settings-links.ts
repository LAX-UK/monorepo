import { CLIENT_ROUTES } from "./client-routes";

/**
 * The sections of Bid settings, in page order. Each has its own address on the one settings page
 * (`/settings#alerts`), so a link or an email opens the page at the right place.
 */
export const BID_SETTINGS_SECTIONS = ["bidding", "alerts", "interests", "appearance"] as const;
export type BidSettingsSection = (typeof BID_SETTINGS_SECTIONS)[number];

export function bidSettingsHref(section: BidSettingsSection): string {
  return `${CLIENT_ROUTES.settings}#${section}`;
}

/** Where "choose what we send" links go: the Alerts section. */
export const NOTIFICATION_SETTINGS_HREF = bidSettingsHref("alerts");
