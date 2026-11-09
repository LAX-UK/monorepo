import type { EnquiryDealRecord } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";

/** One private sale deal a subject is, or was ever named as, a party to. */
export type RetentionDealRow = {
  stage: string;
  agreed_at: Date | string | null;
  cancelled_at: Date | string | null;
  /** When the deal settled, from its stage history; null if it never did. */
  settled_at: Date | string | null;
  /** When checks started to count for the deal: the enquiry's date, or the deal's own. */
  since: Date | string;
};

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

/**
 * What the retention rule needs about each deal. A check counts for the deal when the subject's
 * evidence was created since the enquiry arrived (staff vet the person before converting), which
 * is the same window the enquiry's own hold uses.
 */
export function dealRecordsFromRows(
  rows: readonly RetentionDealRow[],
  latestEvidenceAt: Date | null,
): EnquiryDealRecord[] {
  return rows.map((row) => ({
    stage: row.stage as PrivateSaleDealStage,
    agreedAt: row.agreed_at ? toDate(row.agreed_at) : null,
    endedAt:
      row.stage === "cancelled"
        ? row.cancelled_at
          ? toDate(row.cancelled_at)
          : null
        : row.settled_at
          ? toDate(row.settled_at)
          : null,
    hasComplianceCase: latestEvidenceAt !== null && latestEvidenceAt >= toDate(row.since),
  }));
}
