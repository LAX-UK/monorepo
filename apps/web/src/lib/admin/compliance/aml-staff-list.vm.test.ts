import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { describe, expect, it } from "vitest";
import {
  AML_DECIDE_REASONS,
  amlAttention,
  amlListHref,
  amlMetrics,
  amlRangeSummary,
  amlStageAccess,
  amlTimeline,
  toAmlStaffRow,
} from "./aml-staff-list.vm";

const screening: AdminAmlScreeningRow = {
  id: "scr_1",
  userId: "user_12345678",
  providerSessionId: "sess_1",
  matchStatus: "potential_match",
  monitorStatus: "active",
  totalHits: 2,
  categories: ["sanction", "pep"],
  hits: [
    {
      matchedName: "Ada L.",
      countries: ["GB"],
      dateOfBirth: null,
      matchTypes: ["name_exact"],
      categories: ["sanction"],
      listings: {
        sanction: [
          { sourceName: "UK sanctions list", sourceUrl: null, snippet: "Listed 2020", date: null },
        ],
        pep: [],
      },
    },
  ],
  checkType: "onboarding",
  decisionOutcome: "pending_review",
  reviewStatus: "pending",
  triageRecommendation: null,
  triagedByUserId: null,
  triagedAt: null,
  triageNotes: null,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNotes: null,
  screenedAt: "2026-10-20T10:00:00.000Z",
  createdAt: "2026-10-20T10:00:00.000Z",
};

const triaged: AdminAmlScreeningRow = {
  ...screening,
  triageRecommendation: "recommend_block",
  triagedByUserId: "analyst_1",
  triagedAt: "2026-10-21T09:00:00.000Z",
  triageNotes: "Name and date of birth match",
};

describe("AML staff list view model", () => {
  it("names the client from the lookup, else by a short ID", () => {
    expect(toAmlStaffRow(screening).client).toBe("Client user_123");
    expect(toAmlStaffRow(screening, new Map([["user_12345678", "Ada Lovelace"]])).client).toBe(
      "Ada Lovelace",
    );
  });

  it("reads the triage recommendation however the API spells it", () => {
    expect(toAmlStaffRow(screening).triage.label).toBe("Awaiting triage");
    expect(toAmlStaffRow(triaged).triage).toMatchObject({
      recommendation: "block",
      label: "Recommended block",
    });
    expect(toAmlStaffRow({ ...triaged, triageRecommendation: "clear" }).triage.recommendation).toBe(
      "clear",
    );
  });

  it("shows the hits as plain facts and only the watchlists that listed them", () => {
    const [hit] = toAmlStaffRow(screening).hits;
    expect(hit?.facts).toEqual(["Match types: name_exact", "Countries: GB"]);
    expect(hit?.listings).toEqual([
      {
        category: "Sanctions",
        items: [{ source: "UK sanctions list", date: null, snippet: "Listed 2020" }],
      },
    ]);
  });

  describe("maker-checker access", () => {
    const caps = { canTriage: true, canDecide: true, currentUserId: "mlro_1" };

    it("lets an analyst triage once, and not decide before there is a triage", () => {
      expect(amlStageAccess(toAmlStaffRow(screening), caps)).toEqual({
        triage: "available",
        decide: "needs-triage",
      });
      expect(amlStageAccess(toAmlStaffRow(triaged), caps)).toEqual({
        triage: "done",
        decide: "available",
      });
    });

    it("keeps the person who triaged from also deciding", () => {
      const access = amlStageAccess(toAmlStaffRow(triaged), {
        ...caps,
        currentUserId: "analyst_1",
      });
      expect(access.decide).toBe("same-person");
      expect(AML_DECIDE_REASONS["same-person"]).toMatch(/different MLRO/);
    });

    it("withholds each stage from a role without its permission", () => {
      expect(
        amlStageAccess(toAmlStaffRow(screening), { ...caps, canTriage: false, canDecide: false }),
      ).toEqual({ triage: "no-permission", decide: "no-permission" });
    });
  });

  it("tells the screening's story newest first", () => {
    const decided = toAmlStaffRow({
      ...triaged,
      decisionOutcome: "blocked",
      reviewedAt: "2026-10-22T11:00:00.000Z",
      reviewedByUserId: "mlro_1",
      reviewNotes: "Confirmed with the provider",
    });
    expect(amlTimeline(decided).map((event) => event.id)).toEqual([
      "decision",
      "triage",
      "screened",
    ]);
    expect(amlTimeline(toAmlStaffRow(screening)).map((event) => event.id)).toEqual(["screened"]);
  });

  it("builds links that restart paging and drop one-off params", () => {
    expect(amlListHref({ offset: "50", success: "Done", limit: "25" }, { limit: 100 })).toBe(
      "/admin/compliance/aml?limit=100",
    );
    expect(amlListHref({ limit: "25" }, { offset: 25 })).toBe(
      "/admin/compliance/aml?limit=25&offset=25",
    );
  });

  it("links the cross-queues and the metrics read in full", () => {
    expect(
      amlAttention({ manualReviewCount: 1, sourceOfFundsPending: 4 }).map((item) => [
        item.count,
        item.label,
      ]),
    ).toEqual([
      [1, "payment is held for manual review"],
      [4, "source of funds cases are pending"],
    ]);
    expect(
      amlMetrics({ total: 1200, awaitingTriage: 800, triaged: 400, escalated: 3 }).map((metric) => [
        metric.label,
        metric.value,
      ]),
    ).toEqual([
      ["Awaiting triage", "800"],
      ["Awaiting MLRO decision", "400"],
      ["Recommended block", "3"],
      ["Pending in total", "1,200"],
    ]);
  });

  it("summarises the range", () => {
    expect(amlRangeSummary(0, 50, 312)).toBe("1–50 of 312 screenings");
    expect(amlRangeSummary(0, 1, 1)).toBe("1–1 of 1 screening");
  });
});
