import { describe, expect, it } from "vitest";
import { buildAdminAmlTableRow, summarizeAmlQueue } from "./admin-aml-table.vm";

const baseRow = {
  userId: "u1",
  providerSessionId: "p1",
  monitorStatus: "monitored",
  totalHits: 2,
  categories: ["sanction"],
  decisionOutcome: "review",
  reviewStatus: "pending",
  triageRecommendation: null,
  triagedByUserId: null,
  triagedAt: null,
  triageNotes: null,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNotes: null,
  screenedAt: "2026-01-01",
  createdAt: "2026-01-01",
  hits: [],
  checkType: "initial_result",
};

describe("admin-aml-table.vm", () => {
  it("humanizes match and decision labels", () => {
    const row = buildAdminAmlTableRow({
      id: "s1",
      matchStatus: "possible_match",
      ...baseRow,
    });
    expect(row.matchStatusLabel).toBe("Possible match");
    expect(row.monitorStatusLabel).toBe("Monitored");
    expect(row.decisionOutcomeLabel).toBe("Review");
    expect(row.triageLabel).toBe("Awaiting triage");
  });

  it("summarizes queue counts", () => {
    const rows = [
      buildAdminAmlTableRow({
        id: "1",
        matchStatus: "no_match",
        ...baseRow,
        totalHits: 0,
        categories: [],
        decisionOutcome: "review",
      }),
      buildAdminAmlTableRow({
        id: "2",
        matchStatus: "possible_match",
        ...baseRow,
        triageRecommendation: "recommend_block",
        triagedByUserId: "staff",
      }),
    ];
    expect(summarizeAmlQueue(rows)).toEqual({ pending: 1, triaged: 1, escalated: 1 });
  });
});
