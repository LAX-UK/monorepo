import { CLIENT_ROUTES } from "./client-routes";

/**
 * The sections of Bid settings, in page order. Each is an anchor on the one settings page, so a
 * link can open the page at the right place ("Choose what we send" opens Notifications).
 */
export const BID_SETTINGS_SECTIONS = [
  "bidding",
  "notifications",
  "interests",
  "appearance",
  "profile",
] as const;
export type BidSettingsSection = (typeof BID_SETTINGS_SECTIONS)[number];

export function bidSettingsHref(section: BidSettingsSection): string {
  return `${CLIENT_ROUTES.settings}#${section}`;
}

export const NOTIFICATION_SETTINGS_HREF = bidSettingsHref("notifications");
