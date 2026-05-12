import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import { summarizeSettlementReadiness } from "./payout-settlement-readiness.vm";

function row(partial: Partial<AdminPayoutRow>): AdminPayoutRow {
  return {
    id: "p1",
    legalEntityId: "le1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    grossAmount: "100",
    platformFee: "10",
    stripeFee: "2",
    netAmount: "88",
    currency: "GBP",
    status: "scheduled",
    stripeTransferId: null,
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: "2026-01-15T00:00:00.000Z",
    ...partial,
  };
}

describe("summarizeSettlementReadiness", () => {
  it("counts in-flight missing transfer ref", () => {
    const s = summarizeSettlementReadiness([
      row({ id: "a", status: "scheduled", stripeTransferId: null }),
      row({ id: "b", status: "in_transit", stripeTransferId: "tr_1" }),
    ]);
    expect(s.inFlightCount).toBe(2);
    expect(s.missingTransferRefCount).toBe(1);
  });

  it("dedupes blocker payouts", () => {
    const s = summarizeSettlementReadiness([
      row({ id: "x", status: "failed", failureReason: "x" }),
    ]);
    expect(s.failedCount).toBe(1);
    expect(s.withFailureReasonCount).toBe(1);
    expect(s.blockerPayoutCount).toBe(1);
  });
});
