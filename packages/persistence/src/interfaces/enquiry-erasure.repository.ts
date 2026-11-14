import type { Database } from "@auction/db";
import type { EnquiryHoldEnd } from "@auction/domain";

/** Whose enquiries to anonymise: signed-in accounts by id, or a sender by email address. */
export type EnquiryErasureTarget =
  | { kind: "accounts"; userIds: readonly string[] }
  | { kind: "email"; email: string };

/** What one erasure changed. Counts only; never any personal data. */
export type EnquiryErasureCounts = {
  /** Enquiries whose sender details were replaced. */
  enquiries: number;
  /** Internal notes whose text was replaced. */
  notes: number;
  /** Attachments detached and queued for deletion with their stored files. */
  attachments: number;
  /** Enquiries left whole because they belong to a deal. */
  held: number;
  /** When the held enquiries can be erased; present only when something was held. */
  hold?: EnquiryHoldEnd;
};

/**
 * Anonymises enquiries on request or after an account purge. Safe to run again: rows already
 * anonymised are not touched or counted.
 */
export interface IEnquiryErasureRepository {
  anonymiseInTransaction(tx: Database, target: EnquiryErasureTarget): Promise<EnquiryErasureCounts>;
}
