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
  submissionUpdatesEmail: true,
  submissionUpdatesPush: true,
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

type NotificationTypeConfig = {
  inApp: keyof NotificationPreference | null;
  push: keyof NotificationPreference | null;
  email: keyof NotificationPreference | null;
  whatsapp: keyof NotificationPreference | null;
  template: string | null;
};

const NOTIFICATION_TYPE_CONFIG: Record<string, NotificationTypeConfig> = {
  outbid: {
    inApp: "outbidInApp",
    push: "outbidPush",
    email: "outbidEmail",
    whatsapp: "outbidWhatsapp",
    template: "bid-outbid",
  },
  lot_cancelled: {
    inApp: "outbidInApp",
    push: "outbidPush",
    email: "outbidEmail",
    whatsapp: "outbidWhatsapp",
    template: null,
  },
  lot_won: {
    inApp: "wonInApp",
    push: "wonPush",
    email: "wonEmail",
    whatsapp: "wonWhatsapp",
    template: "lot-won",
  },
  lot_lost: {
    inApp: "lostInApp",
    push: null,
    email: "lostEmail",
    whatsapp: "lostWhatsapp",
    template: null,
  },
  lot_ending_soon: {
    inApp: "endingSoonInApp",
    push: "endingSoonPush",
    email: "endingSoonEmail",
    whatsapp: "endingSoonWhatsapp",
    template: null,
  },
  watchlist_starting: {
    inApp: "watchlistInApp",
    push: null,
    email: "watchlistEmail",
    whatsapp: "watchlistWhatsapp",
    template: null,
  },
  watchlist_ending_soon: {
    inApp: "endingSoonInApp",
    push: "endingSoonPush",
    email: "endingSoonEmail",
    whatsapp: "endingSoonWhatsapp",
    template: null,
  },
  payment_received: {
    inApp: "paymentInApp",
    push: null,
    email: "paymentEmail",
    whatsapp: "paymentWhatsapp",
    template: "payment-receipt",
  },
  payment_due: {
    inApp: "paymentInApp",
    push: null,
    email: "paymentEmail",
    whatsapp: "paymentWhatsapp",
    template: "payment-invoice",
  },
  lot_ended_seller: {
    inApp: null,
    push: null,
    email: "lotEndedSellerEmail",
    whatsapp: "lotEndedSellerWhatsapp",
    template: "lot-ended-seller",
  },
  submission_approved: {
    inApp: null,
    push: "submissionUpdatesPush",
    email: "submissionUpdatesEmail",
    whatsapp: null,
    template: "submission-approved",
  },
  submission_converted: {
    inApp: null,
    push: "submissionUpdatesPush",
    email: "submissionUpdatesEmail",
    whatsapp: null,
    template: "submission-converted",
  },
  submission_rejected: {
    inApp: null,
    push: "submissionUpdatesPush",
    email: "submissionUpdatesEmail",
    whatsapp: null,
    template: "submission-rejected",
  },
  submission_draft_reminder: {
    inApp: null,
    push: "submissionUpdatesPush",
    email: "submissionUpdatesEmail",
    whatsapp: null,
    template: "submission-draft-reminder",
  },
};

export function emailPreferenceKey(type: string): keyof NotificationPreference | null {
  return NOTIFICATION_TYPE_CONFIG[type]?.email ?? null;
}

export function whatsappPreferenceKey(type: string): keyof NotificationPreference | null {
  return NOTIFICATION_TYPE_CONFIG[type]?.whatsapp ?? null;
}

export function notificationTypeToTemplate(type: string): string | null {
  return NOTIFICATION_TYPE_CONFIG[type]?.template ?? null;
}

export function inAppPreferenceKey(type: string): keyof NotificationPreference | null {
  return NOTIFICATION_TYPE_CONFIG[type]?.inApp ?? null;
}

export function pushPreferenceKey(type: string): keyof NotificationPreference | null {
  return NOTIFICATION_TYPE_CONFIG[type]?.push ?? null;
}
