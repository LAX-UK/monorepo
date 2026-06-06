import { describe, expect, it } from "vitest";
import { buildAdminAmlTableRow, summarizeAmlQueue } from "./admin-aml-table.vm";

describe("admin-aml-table.vm", () => {
  it("humanizes match and decision labels", () => {
    const row = buildAdminAmlTableRow({
      id: "s1",
      userId: "u1",
      providerSessionId: "p1",
      matchStatus: "potential_match",
      monitorStatus: "open",
      totalHits: 2,
      categories: ["sanctions"],
      decisionOutcome: "pending",
      reviewStatus: "open",
      triageRecommendation: null,
      triagedByUserId: null,
      triagedAt: null,
      triageNotes: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNotes: null,
      screenedAt: "2026-01-01",
      createdAt: "2026-01-01",
    });
    expect(row.matchStatusLabel).toBe("Potential match");
    expect(row.decisionOutcomeLabel).toBe("Pending review");
    expect(row.triageLabel).toBe("Awaiting triage");
  });

  it("summarizes queue counts", () => {
    const rows = [
      buildAdminAmlTableRow({
        id: "1",
        userId: "u",
        providerSessionId: "p",
        matchStatus: "no_match",
        monitorStatus: "open",
        totalHits: 0,
        categories: [],
        decisionOutcome: "pending",
        reviewStatus: "open",
        triageRecommendation: null,
        triagedByUserId: null,
        triagedAt: null,
        triageNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNotes: null,
        screenedAt: "2026-01-01",
        createdAt: "2026-01-01",
      }),
      buildAdminAmlTableRow({
        id: "2",
        userId: "u",
        providerSessionId: "p",
        matchStatus: "potential_match",
        monitorStatus: "open",
        totalHits: 1,
        categories: [],
        decisionOutcome: "escalate",
        reviewStatus: "open",
        triageRecommendation: "recommend_clear",
        triagedByUserId: "staff",
        triagedAt: null,
        triageNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNotes: null,
        screenedAt: "2026-01-01",
        createdAt: "2026-01-01",
      }),
    ];
    expect(summarizeAmlQueue(rows)).toEqual({ pending: 1, triaged: 0, escalated: 1 });
  });
});
