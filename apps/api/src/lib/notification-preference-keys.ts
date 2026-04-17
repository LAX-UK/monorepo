import type { NotificationPreference } from "@auction/types";

const DEFAULTS: NotificationPreference = {
  userId: "",
  outbidInApp: true,
  wonInApp: true,
  lostInApp: true,
  endingSoonInApp: true,
  watchlistInApp: true,
  paymentInApp: true,
  outbidPush: true,
  wonPush: true,
  endingSoonPush: false,
  quietStart: null,
  quietEnd: null,
  updatedAt: new Date(),
};

export function defaultNotificationPreference(userId: string): NotificationPreference {
  return { ...DEFAULTS, userId, updatedAt: new Date() };
}

export function inAppPreferenceKey(type: string): keyof NotificationPreference | null {
  switch (type) {
    case "outbid":
    case "auction_cancelled":
      return "outbidInApp";
    case "auction_won":
      return "wonInApp";
    case "auction_lost":
      return "lostInApp";
    case "auction_ending_soon":
    case "watchlist_ending_soon":
      return "endingSoonInApp";
    case "watchlist_starting":
      return "watchlistInApp";
    case "payment_received":
    case "payment_due":
      return "paymentInApp";
    default:
      return null;
  }
}

export function pushPreferenceKey(type: string): keyof NotificationPreference | null {
  switch (type) {
    case "outbid":
    case "auction_cancelled":
      return "outbidPush";
    case "auction_won":
      return "wonPush";
    case "auction_ending_soon":
    case "watchlist_ending_soon":
      return "endingSoonPush";
    default:
      return null;
  }
}
