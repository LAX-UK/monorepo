export type UserNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId: string | null;
  read: boolean;
  /** When set, hidden from default inbox lists (soft archive). */
  archivedAt?: Date | null;
  createdAt: Date;
};

export type NotificationPreference = {
  userId: string;
  outbidInApp: boolean;
  wonInApp: boolean;
  lostInApp: boolean;
  endingSoonInApp: boolean;
  watchlistInApp: boolean;
  paymentInApp: boolean;
  outbidPush: boolean;
  wonPush: boolean;
  endingSoonPush: boolean;
  outbidEmail: boolean;
  wonEmail: boolean;
  lostEmail: boolean;
  endingSoonEmail: boolean;
  watchlistEmail: boolean;
  paymentEmail: boolean;
  lotEndedSellerEmail: boolean;
  outbidWhatsapp: boolean;
  wonWhatsapp: boolean;
  lostWhatsapp: boolean;
  endingSoonWhatsapp: boolean;
  watchlistWhatsapp: boolean;
  paymentWhatsapp: boolean;
  lotEndedSellerWhatsapp: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  updatedAt: Date;
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
};
