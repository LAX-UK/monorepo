import { describe, expect, it } from "vitest";
import { buildAdminSofTableRow, resolveSofDisplayStatus } from "./admin-sof-table.vm";

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
};

describe("admin-sof-table.vm", () => {
  it("maps pending without triage to pending display status", () => {
    expect(resolveSofDisplayStatus("pending", null)).toBe("pending");
    const row = buildAdminSofTableRow(baseRow);
    expect(row.displayStatus).toBe("pending");
    expect(row.triageLabel).toBe("Awaiting triage");
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

  it("uses recommend-prefixed triage labels", () => {
    const row = buildAdminSofTableRow({
      ...baseRow,
      triageRecommendation: "recommend_reject",
    });
    expect(row.triageLabel).toBe("Recommend reject");
  });

  it("passes through approved and rejected statuses", () => {
    expect(resolveSofDisplayStatus("approved", "recommend_approve")).toBe("approved");
    expect(resolveSofDisplayStatus("rejected", "recommend_reject")).toBe("rejected");
  });
});
