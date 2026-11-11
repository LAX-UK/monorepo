import type { lotReoffer, sellerConsent } from "@auction/db/schema";
import {
  REOFFER_STATUSES,
  type ReofferRecord,
  type ReofferStatus,
  SELLER_CONSENT_STATUSES,
  type SellerConsentStatus,
} from "@auction/domain";
import type {
  LotReofferView,
  SellerConsentChannel,
  SellerConsentTerms,
  SellerConsentView,
  SellerPreferredNext,
} from "../interfaces/lot-reoffer.js";

type LotReofferRow = typeof lotReoffer.$inferSelect;
type SellerConsentRow = typeof sellerConsent.$inferSelect;

const CHANNELS: readonly SellerConsentChannel[] = ["workspace", "recorded_by_staff", "house_stock"];
const PREFERENCES: readonly SellerPreferredNext[] = ["later_sale", "return_to_me", "talk_to_us"];

/** A stored value the database allows but the application does not know: never guess its meaning. */
function narrow<T extends string>(value: string, allowed: readonly T[], what: string): T {
  const found = allowed.find((candidate) => candidate === value);
  if (found === undefined) throw new Error(`Unknown ${what} "${value}"`);
  return found;
}

/** Whole pence as the `numeric(18, 2)` pounds string the lot stores. */
export function penceToDecimal(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0) throw new Error(`Invalid amount ${pence}`);
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}`;
}

/** The `numeric(18, 2)` pounds string a lot or default stores, as whole pence. */
export function decimalToPence(decimal: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?\d*$/.exec(decimal.trim());
  if (!match) throw new Error(`Invalid amount "${decimal}"`);
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(pence)) throw new Error(`Amount out of range "${decimal}"`);
  return pence;
}

export function toLotReofferView(row: LotReofferRow): LotReofferView {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerDefaultId: row.buyerDefaultId,
    sequence: row.sequence,
    offeredUserId: row.offeredUserId,
    offeredLegalEntityId: row.offeredLegalEntityId,
    sourceBidId: row.sourceBidId,
    amountPence: row.amountPence,
    status: narrow<ReofferStatus>(row.status, REOFFER_STATUSES, "re-offer status"),
    sellerConsentId: row.sellerConsentId,
    offerSentAt: row.offerSentAt,
    offerEndsAt: row.offerEndsAt,
    respondedAt: row.respondedAt,
    declineReason: row.declineReason,
    invoiceId: row.invoiceId,
    paymentId: row.paymentId,
    createdBy: row.createdBy,
    closedBy: row.closedBy,
    closeReason: row.closeReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The offer as the domain rules see it; `offerSentAt` comes from `offer_sent_at`. */
export function toReofferRecord(row: Pick<LotReofferRow, "status" | "offerSentAt">): ReofferRecord {
  return {
    status: narrow<ReofferStatus>(row.status, REOFFER_STATUSES, "re-offer status"),
    offerSentAt: row.offerSentAt,
  };
}

export function toSellerConsentView(row: SellerConsentRow): SellerConsentView {
  return {
    id: row.id,
    subjectType: narrow(row.subjectType, ["lot_reoffer"] as const, "consent subject"),
    subjectId: row.subjectId,
    sellerLegalEntityId: row.sellerLegalEntityId,
    lotId: row.lotId,
    termsSnapshot: row.termsSnapshot as SellerConsentTerms,
    status: narrow<SellerConsentStatus>(row.status, SELLER_CONSENT_STATUSES, "consent status"),
    channel: row.channel === null ? null : narrow(row.channel, CHANNELS, "consent channel"),
    answeredByUserId: row.answeredByUserId,
    answeredAt: row.answeredAt,
    note: row.note,
    requestedAt: row.requestedAt,
    dueAt: row.dueAt,
    remindedAt: row.remindedAt,
    preferredNext:
      row.preferredNext === null
        ? null
        : narrow(row.preferredNext, PREFERENCES, "seller preference"),
  };
}
