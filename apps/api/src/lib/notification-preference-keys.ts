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
  outbidEmail: false,
  wonEmail: true,
  lostEmail: true,
  endingSoonEmail: true,
  watchlistEmail: false,
  paymentEmail: true,
  lotEndedSellerEmail: true,
  outbidWhatsapp: false,
  wonWhatsapp: false,
  lostWhatsapp: false,
  endingSoonWhatsapp: false,
  watchlistWhatsapp: false,
  paymentWhatsapp: false,
  lotEndedSellerWhatsapp: false,
  quietStart: null,
  quietEnd: null,
  updatedAt: new Date(),
};

export function defaultNotificationPreference(userId: string): NotificationPreference {
  return { ...DEFAULTS, userId, updatedAt: new Date() };
}

export function emailPreferenceKey(type: string): keyof NotificationPreference | null {
  switch (type) {
    case "outbid":
    case "lot_cancelled":
      return "outbidEmail";
    case "lot_won":
      return "wonEmail";
    case "lot_lost":
      return "lostEmail";
    case "lot_ending_soon":
    case "watchlist_ending_soon":
      return "endingSoonEmail";
    case "watchlist_starting":
      return "watchlistEmail";
    case "payment_received":
    case "payment_due":
      return "paymentEmail";
    case "lot_ended_seller":
      return "lotEndedSellerEmail";
    default:
      return null;
  }
}

export function whatsappPreferenceKey(type: string): keyof NotificationPreference | null {
  switch (type) {
    case "outbid":
    case "lot_cancelled":
      return "outbidWhatsapp";
    case "lot_won":
      return "wonWhatsapp";
    case "lot_lost":
      return "lostWhatsapp";
    case "lot_ending_soon":
    case "watchlist_ending_soon":
      return "endingSoonWhatsapp";
    case "watchlist_starting":
      return "watchlistWhatsapp";
    case "payment_received":
    case "payment_due":
      return "paymentWhatsapp";
    case "lot_ended_seller":
      return "lotEndedSellerWhatsapp";
    default:
      return null;
  }
}

export function notificationTypeToTemplate(type: string): string | null {
  switch (type) {
    case "outbid":
      return "bid-outbid";
    case "lot_won":
      return "lot-won";
    case "lot_ended_seller":
      return "lot-ended-seller";
    case "payment_received":
      return "payment-receipt";
    case "payment_due":
      return "payment-invoice";
    default:
      return null;
  }
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
