import type { AdminPayoutRow } from "@/lib/data/http/admin.server";

export type SettlementReadinessSummary = {
  inFlightCount: number;
  missingTransferRefCount: number;
  withFailureReasonCount: number;
  withStatementErrorCount: number;
  clawbackCount: number;
  failedCount: number;
  reversedCount: number;
  blockerPayoutCount: number;
};

/** Snapshot counts for payouts currently in view (e.g. same filters as the list). */
export function summarizeSettlementReadiness(
  payouts: AdminPayoutRow[],
): SettlementReadinessSummary {
  const inFlight = payouts.filter((p) => p.status === "scheduled" || p.status === "in_transit");
  const missingTransferRef = inFlight.filter((p) => !p.stripeTransferId?.trim());
  const withFailureReason = payouts.filter((p) => p.failureReason);
  const withStatementError = payouts.filter((p) => p.statementGenerationError);
  const clawback = payouts.filter((p) => p.status === "clawback_pending");
  const failed = payouts.filter((p) => p.status === "failed");
  const reversed = payouts.filter((p) => p.status === "reversed");
  const blockerIds = new Set<string>();
  for (const p of payouts) {
    if (p.failureReason || p.statementGenerationError) blockerIds.add(p.id);
    if (p.status === "clawback_pending" || p.status === "failed" || p.status === "reversed") {
      blockerIds.add(p.id);
    }
  }
  return {
    inFlightCount: inFlight.length,
    missingTransferRefCount: missingTransferRef.length,
    withFailureReasonCount: withFailureReason.length,
    withStatementErrorCount: withStatementError.length,
    clawbackCount: clawback.length,
    failedCount: failed.length,
    reversedCount: reversed.length,
    blockerPayoutCount: blockerIds.size,
  };
}
