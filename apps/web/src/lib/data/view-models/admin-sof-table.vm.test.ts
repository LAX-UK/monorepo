import { describe, expect, it } from "vitest";
import {
  buildAdminSofTableRow,
  buildSettlementSummaryLabel,
  resolveSofDisplayStatus,
} from "./admin-sof-table.vm";

const baseRow = {
  id: "sof_1",
  userId: "u1",
  status: "pending",
  trigger: "threshold",
  thresholdAmount: "9000.00",
  exposureAmount: "12000.00",
  currency: "GBP",
  declaredSource: null,
  triageRecommendation: null,
  triagedByUserId: null,
  triagedAt: null,
  triageNotes: null,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNotes: null,
  evidence: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  buyerEmail: "buyer@example.com",
  buyerName: "Buyer One",
  buyerLabel: "Buyer One",
  settlementSummary: "Lot 42 · Summer Sale (+2 more)",
  settlementItemCount: 3,
  pendingCasesForBuyer: 1,
};

describe("admin-sof-table.vm", () => {
  it("maps pending without triage to pending display status", () => {
    expect(resolveSofDisplayStatus("pending", null)).toBe("pending");
    const row = buildAdminSofTableRow(baseRow);
    expect(row.displayStatus).toBe("pending");
    expect(row.triageLabel).toBe("Awaiting triage");
    expect(row.buyerLabel).toBe("Buyer One");
    expect(row.settlementSummary).toBe("Lot 42 · Summer Sale (+2 more)");
  });

  it("maps pending with triage to awaiting_decision display status", () => {
    expect(resolveSofDisplayStatus("pending", "recommend_approve")).toBe("awaiting_decision");
    const row = buildAdminSofTableRow({
      ...baseRow,
      triageRecommendation: "recommend_approve",
    });
    expect(row.displayStatus).toBe("awaiting_decision");
    expect(row.triageLabel).toBe("Recommend approve");
  });

  it("uses correct trigger labels for all enum values", () => {
    expect(buildAdminSofTableRow({ ...baseRow, trigger: "threshold" }).triggerLabel).toBe(
      "Single transaction threshold",
    );
    expect(buildAdminSofTableRow({ ...baseRow, trigger: "linked_transactions" }).triggerLabel).toBe(
      "Aggregated linked transactions",
    );
    expect(buildAdminSofTableRow({ ...baseRow, trigger: "risk_indicator" }).triggerLabel).toBe(
      "Risk indicator",
    );
    expect(buildAdminSofTableRow({ ...baseRow, trigger: "manual" }).triggerLabel).toBe(
      "Manual compliance flag",
    );
  });

  it("falls back buyer label to email then unknown", () => {
    expect(
      buildAdminSofTableRow({
        ...baseRow,
        buyerLabel: null,
        buyerName: null,
        buyerEmail: "only@email.com",
      }).buyerLabel,
    ).toBe("only@email.com");
    expect(
      buildAdminSofTableRow({
        ...baseRow,
        buyerLabel: null,
        buyerName: null,
        buyerEmail: null,
      }).buyerLabel,
    ).toBe("Unknown buyer");
  });

  it("buildSettlementSummaryLabel falls back to count when summary missing", () => {
    expect(buildSettlementSummaryLabel(null, 2)).toBe("2 settlements");
    expect(buildSettlementSummaryLabel(null, 0)).toBeNull();
  });

  it("passes through approved and rejected statuses", () => {
    expect(resolveSofDisplayStatus("approved", "recommend_approve")).toBe("approved");
    expect(resolveSofDisplayStatus("rejected", "recommend_reject")).toBe("rejected");
  });
});
