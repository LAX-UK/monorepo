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
    case "lot_cancelled":
      return "outbidInApp";
    case "lot_won":
      return "wonInApp";
    case "lot_lost":
      return "lostInApp";
    case "lot_ending_soon":
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
    case "lot_cancelled":
      return "outbidPush";
    case "lot_won":
      return "wonPush";
    case "lot_ending_soon":
    case "watchlist_ending_soon":
      return "endingSoonPush";
    default:
      return null;
  }
}
