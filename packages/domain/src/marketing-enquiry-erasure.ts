import type { PrivateSaleDealStage } from "@auction/types";
import type { EnquiryStatus } from "./marketing-enquiry-vocabulary.js";
import { isDealClosed } from "./private-sale-deal/views.js";

/**
 * What an erased sender's enquiry shows afterwards. The reference, intent, department, dates and
 * routing stay so staff counts and records still add up; the sender's words and contact details
 * are replaced by these fixed values. The email is a reserved `.invalid` address, so nothing can
 * ever be sent to it.
 */
export const ERASED_ENQUIRY = {
  name: "Erased sender",
  email: "erased@erased.invalid",
  message: "[Removed at the sender's request]",
  note: "[Removed]",
} as const;

/**
 * Statuses whose enquiry is kept whole. A converted private sale enquiry belongs to its deal,
 * and the deal's records need the original contact until the deal is finished.
 */
export const ENQUIRY_ERASURE_HOLD_STATUSES: readonly EnquiryStatus[] = ["converted"];

/**
 * How long the record of a private sale is kept after the deal ends: five years from the
 * transaction (Money Laundering Regulations 2017, regulation 40). The owner's answer on deal record
 * retention replaces this; until then it is the default, and it is configurable.
 */
export const DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS = 5;

/** What the erasure rule needs to know about a deal made from an enquiry. */
export type EnquiryDealRecord = {
  stage: PrivateSaleDealStage;
  /** When both sides agreed the price; `null` if the deal never reached agreement. */
  agreedAt: Date | null;
  /** When the deal ended (settled or cancelled); `null` if that is not known. */
  endedAt: Date | null;
  /** An identity, screening or source-of-funds case was opened for a party while the deal ran. */
  hasComplianceCase: boolean;
};

export function addYears(from: Date, years: number): Date {
  const to = new Date(from);
  to.setUTCFullYear(to.getUTCFullYear() + years);
  return to;
}

/** Whether a deal's record must still be kept. A deal with no known end date is kept. */
export function isDealRecordRetained(
  deal: EnquiryDealRecord,
  now: Date,
  retentionYears: number,
): boolean {
  if (!isDealClosed(deal.stage)) return true;
  // A deal withdrawn before anyone agreed a price, with no check opened for either side, is not a
  // transaction and leaves nothing the regulations require.
  if (deal.stage === "cancelled" && deal.agreedAt === null && !deal.hasComplianceCase) {
    return false;
  }
  return deal.endedAt === null || now < addYears(deal.endedAt, retentionYears);
}

/**
 * Whether an enquiry is kept whole. A converted enquiry is part of its deal's record (the original
 * contact, the work described, its provenance), so it is held while any deal made from it is open
 * and, once a deal has ended, until the retention period has run from the end. A deal cancelled
 * before agreement with no check opened is the one exception. An enquiry marked converted that has
 * no deal at all stays held, because nothing shows its deal is finished.
 */
export function isEnquiryHeldFromErasure(
  status: string,
  deals: readonly EnquiryDealRecord[] = [],
  now: Date = new Date(),
  retentionYears: number = DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS,
): boolean {
  if (!(ENQUIRY_ERASURE_HOLD_STATUSES as readonly string[]).includes(status)) return false;
  if (deals.length === 0) return true;
  return deals.some((deal) => isDealRecordRetained(deal, now, retentionYears));
}
