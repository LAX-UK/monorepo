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
 * Whether an enquiry is kept whole. A converted enquiry is held while its deal is open, and
 * released once every deal made from it has ended (settled or cancelled). An enquiry marked
 * converted that has no deal at all stays held, because nothing shows its deal is finished.
 */
export function isEnquiryHeldFromErasure(
  status: string,
  dealStages: readonly PrivateSaleDealStage[] = [],
): boolean {
  if (!(ENQUIRY_ERASURE_HOLD_STATUSES as readonly string[]).includes(status)) return false;
  return !(dealStages.length > 0 && dealStages.every(isDealClosed));
}
