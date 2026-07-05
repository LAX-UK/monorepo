import type { NotificationPreference, UserNotification } from "@auction/types";
import { coerceToDate } from "./coerce";

export function parseNotificationPreference(raw: unknown): NotificationPreference {
  const o = raw as Record<string, unknown>;
  return {
    userId: String(o.userId),
    outbidInApp: Boolean(o.outbidInApp),
    wonInApp: Boolean(o.wonInApp),
    lostInApp: Boolean(o.lostInApp),
    endingSoonInApp: Boolean(o.endingSoonInApp),
    watchlistInApp: Boolean(o.watchlistInApp),
    paymentInApp: Boolean(o.paymentInApp),
    outbidPush: Boolean(o.outbidPush),
    wonPush: Boolean(o.wonPush),
    endingSoonPush: Boolean(o.endingSoonPush),
    outbidEmail: Boolean(o.outbidEmail),
    wonEmail: o.wonEmail !== false,
    lostEmail: o.lostEmail !== false,
    endingSoonEmail: o.endingSoonEmail !== false,
    watchlistEmail: Boolean(o.watchlistEmail),
    paymentEmail: o.paymentEmail !== false,
    lotEndedSellerEmail: o.lotEndedSellerEmail !== false,
    submissionUpdatesEmail: o.submissionUpdatesEmail !== false,
    submissionUpdatesPush: o.submissionUpdatesPush !== false,
    outbidWhatsapp: Boolean(o.outbidWhatsapp),
    wonWhatsapp: Boolean(o.wonWhatsapp),
    lostWhatsapp: Boolean(o.lostWhatsapp),
    endingSoonWhatsapp: Boolean(o.endingSoonWhatsapp),
    watchlistWhatsapp: Boolean(o.watchlistWhatsapp),
    paymentWhatsapp: Boolean(o.paymentWhatsapp),
    lotEndedSellerWhatsapp: Boolean(o.lotEndedSellerWhatsapp),
    quietStart: o.quietStart == null || o.quietStart === "" ? null : String(o.quietStart),
    quietEnd: o.quietEnd == null || o.quietEnd === "" ? null : String(o.quietEnd),
    updatedAt: coerceToDate(o.updatedAt),
  };
}

export function parseUserNotification(raw: unknown): UserNotification {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    userId: String(o.userId),
    type: String(o.type),
    title: String(o.title),
    message: String(o.message),
    lotId: o.lotId != null ? String(o.lotId) : o.auctionId != null ? String(o.auctionId) : null,
    submissionId: o.submissionId != null ? String(o.submissionId) : null,
    read: Boolean(o.read),
    archivedAt: o.archivedAt == null || o.archivedAt === "" ? null : coerceToDate(o.archivedAt),
    createdAt: coerceToDate(o.createdAt),
  };
}
