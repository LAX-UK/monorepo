import { isComplianceManualReviewReason } from "@/lib/admin/compliance-manual-review";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";

export type ManualReviewQueueSummary = {
  total: number;
  financeHolds: number;
  complianceHolds: number;
  amlHolds: number;
  sofHolds: number;
};

export function summarizeManualReviewQueue(
  rows: readonly AdminManualReviewPaymentRow[],
): ManualReviewQueueSummary {
  let financeHolds = 0;
  let complianceHolds = 0;
  let amlHolds = 0;
  let sofHolds = 0;
  for (const row of rows) {
    if (isComplianceManualReviewReason(row.manualReviewReason)) {
      complianceHolds += 1;
      if (row.manualReviewReason === "aml_hold") amlHolds += 1;
      if (row.manualReviewReason === "source_of_funds_required") sofHolds += 1;
    } else {
      financeHolds += 1;
    }
  }
  return {
    total: rows.length,
    financeHolds,
    complianceHolds,
    amlHolds,
    sofHolds,
  };
}

export function filterManualReviewRows(
  rows: readonly AdminManualReviewPaymentRow[],
  reasonFilter: string,
): AdminManualReviewPaymentRow[] {
  if (reasonFilter === "finance") {
    return rows.filter((r) => !isComplianceManualReviewReason(r.manualReviewReason));
  }
  if (reasonFilter === "compliance") {
    return rows.filter((r) => isComplianceManualReviewReason(r.manualReviewReason));
  }
  if (reasonFilter.length > 0) {
    return rows.filter((r) => r.manualReviewReason === reasonFilter);
  }
  return [...rows];
}
