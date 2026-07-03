import { parseBidSchema } from "@/lib/data/http/bid.schema";
import { parsePublicLotViewSchema } from "@/lib/data/http/lot.schema";
import { parseLotSchema } from "@/lib/data/http/lot.schema";
import { parseSaleSchema } from "@/lib/data/http/sale.schema";
import { parseItemSubmissionSchema } from "@/lib/data/http/submissions.schema";
import type {
  Bid,
  ItemSubmission,
  Lot,
  NotificationPreference,
  PublicLotView,
  Sale,
  UserNotification,
} from "@auction/types";
import { toOptionalIsoString } from "@auction/validators";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

/** Coerce serialized or unknown values to a Date (RSC props, JSON payloads). */
export function coerceToDate(value: unknown): Date {
  return toDate(value);
}

/** ISO 8601 string when `value` is a valid date; otherwise `undefined`. */
export function coerceToIsoString(value: unknown): string | undefined {
  return toOptionalIsoString(value);
}

export function parseSale(raw: unknown): Sale {
  return parseSaleSchema(raw);
}

export function parseLot(raw: unknown): Lot {
  return parseLotSchema(raw);
}

/** Lot detail from public API — withholds reserve amount when `hasReserve` is present. */
export function parseLotDetail(raw: unknown): Lot | PublicLotView {
  return parsePublicLotViewSchema(raw);
}

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
    updatedAt: toDate(o.updatedAt),
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
    archivedAt: o.archivedAt == null || o.archivedAt === "" ? null : toDate(o.archivedAt),
    createdAt: toDate(o.createdAt),
  };
}

export function parseItemSubmission(raw: unknown): ItemSubmission {
  return parseItemSubmissionSchema(raw);
}

export function parseBid(raw: unknown): Bid {
  return parseBidSchema(raw);
}
