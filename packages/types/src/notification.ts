export type UserNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId: string | null;
  submissionId: string | null;
  /** The account the notification is about; `null` for the person's own personal account. */
  legalEntityId?: string | null;
  read: boolean;
  /** When set, hidden from default inbox lists (soft archive). */
  archivedAt?: Date | null;
  createdAt: Date;
};

/**
 * The account an inbox notification is about, with what the client needs to open it there:
 * opening a notification for another account switches to it when the person is still a member.
 */
export type NotificationAccount = {
  legalEntityId: string;
  kind: "personal" | "organisation";
  displayName: string;
  /** The person is still an active member, so the client can switch to this account. */
  canSwitch: boolean;
};

/** One inbox row: the notification and its account (`null` for the person's own account). */
export type UserNotificationListItem = UserNotification & {
  account: NotificationAccount | null;
  /** The notification asks the person to do something (see the "Needs action" view). */
  needsAction: boolean;
};

/** An organisation the person has muted in their notifications. */
export type NotificationAccountMute = {
  legalEntityId: string;
  displayName: string;
  mutedAt: string;
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
  submissionUpdatesEmail: boolean;
  submissionUpdatesPush: boolean;
  outbidWhatsapp: boolean;
  wonWhatsapp: boolean;
  lostWhatsapp: boolean;
  endingSoonWhatsapp: boolean;
  watchlistWhatsapp: boolean;
  paymentWhatsapp: boolean;
  lotEndedSellerWhatsapp: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  /** The IANA zone quiet hours are kept in ("Europe/London"); the times above are local to it. */
  quietTimeZone: string;
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

export type PushSubscriptionStatusDto = {
  hasServerSubscription: boolean;
};
