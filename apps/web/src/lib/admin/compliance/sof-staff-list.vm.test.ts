import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { describe, expect, it } from "vitest";
import {
  activeSofView,
  formatSofAmount,
  sofAttention,
  sofEmptyCopy,
  sofListHref,
  sofMetrics,
  sofRangeSummary,
  sofTriageLabel,
  sofViews,
  toSofStaffRows,
} from "./sof-staff-list.vm";

const sofCase: AdminSourceOfFundsRow = {
  id: "case_1",
  userId: "user_1",
  status: "pending",
  trigger: "linked_transactions",
  thresholdAmount: "50000.00",
  exposureAmount: "185001.25",
  currency: "GBP",
  declaredSource: null,
  evidence: ["a", "b"],
  triageRecommendation: null,
  triagedByUserId: null,
  triagedAt: null,
  triageNotes: null,
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNotes: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  buyerEmail: "ada@example.test",
  buyerName: null,
  buyerLabel: "Ada Lovelace",
  settlementSummary: null,
  settlementItemCount: 2,
  pendingCasesForBuyer: 3,
};

describe("source of funds staff list view model", () => {
  it("shows the exposure as full pounds, never as 'GBP 185001.25'", () => {
    const [row] = toSofStaffRows([sofCase], "pending");
    expect(row?.exposure).toBe("£185,001.25");
    expect(row?.exposurePence).toBe(18_500_125);
    expect(formatSofAmount("oops", "GBP")).toEqual({ label: "oops", pence: null });
  });

  it("names the buyer, the trigger and the settlement in plain words", () => {
    const [row] = toSofStaffRows([sofCase], "pending");
    expect(row).toMatchObject({
      buyer: "Ada Lovelace",
      trigger: "Linked transactions over the threshold",
      settlement: "2 settlements",
      otherOpenCases: 2,
      evidenceCount: 2,
      triage: "Awaiting triage",
    });
    const [anonymous] = toSofStaffRows(
      [{ ...sofCase, buyerLabel: null, buyerEmail: null, settlementItemCount: 0 }],
      "pending",
    );
    expect(anonymous).toMatchObject({ buyer: "Unknown buyer", settlement: null });
  });

  it("shows a triaged pending case as waiting for the MLRO", () => {
    const [row] = toSofStaffRows(
      [{ ...sofCase, triageRecommendation: "recommend_reject" }],
      "pending",
    );
    expect(row?.status.label).toBe("Awaiting MLRO decision");
    expect(row?.triage).toBe("Recommended reject");
    expect(sofTriageLabel("recommend_approve")).toBe("Recommended approve");
  });

  it("opens the case page with the view and the way back to this list", () => {
    const [row] = toSofStaffRows(
      [{ ...sofCase, status: "rejected" }],
      "rejected",
      "/admin/compliance/source-of-funds?status=rejected",
    );
    expect(row?.href).toBe(
      "/admin/compliance/source-of-funds/case_1?listStatus=rejected&returnTo=%2Fadmin%2Fcompliance%2Fsource-of-funds%3Fstatus%3Drejected",
    );
  });

  it("offers reopening only for a rejected case", () => {
    const rows = toSofStaffRows(
      [
        sofCase,
        { ...sofCase, id: "case_2", status: "rejected" },
        { ...sofCase, id: "case_3", status: "approved" },
      ],
      "pending",
    );
    expect(rows.map((row) => row.canReopen)).toEqual([false, true, false]);
  });

  it("lays the status views out as tabs, with a count only on pending", () => {
    const views = sofViews({ status: "rejected", offset: "50" }, 7);
    expect(views.map((view) => [view.label, view.count])).toEqual([
      ["Pending", 7],
      ["Rejected", undefined],
      ["Approved", undefined],
    ]);
    expect(views[0]?.href).toBe("/admin/compliance/source-of-funds");
    expect(views[1]?.href).toBe("/admin/compliance/source-of-funds?status=rejected");
    expect(activeSofView({ status: "approved" })).toBe("approved");
    expect(activeSofView({ status: "nonsense" })).toBe("pending");
  });

  it("drops one-off params and restarts paging in list links", () => {
    expect(sofListHref({ status: "approved", case: "x", offset: "50" }, { limit: 25 })).toBe(
      "/admin/compliance/source-of-funds?status=approved&limit=25",
    );
    expect(sofListHref({ limit: "25" }, { offset: 25 })).toBe(
      "/admin/compliance/source-of-funds?limit=25&offset=25",
    );
  });

  it("splits the pending metrics by stage and gives one number for the other views", () => {
    const summary = { total: 12, awaitingTriage: 9, triaged: 3 };
    expect(sofMetrics("pending", summary).map((metric) => [metric.label, metric.value])).toEqual([
      ["Awaiting triage", "9"],
      ["Awaiting MLRO decision", "3"],
      ["Pending in total", "12"],
    ]);
    expect(sofMetrics("rejected", summary)).toEqual([
      { id: "total", label: "Rejected cases", value: "12" },
    ]);
  });

  it("links the cross-queues, each with its count", () => {
    expect(
      sofAttention({ manualReviewCount: 2, amlScreeningsPending: 1 }).map((item) => [
        item.count,
        item.label,
        item.href,
      ]),
    ).toEqual([
      [2, "payments are held for manual review", "/admin/payments?manualReview=1"],
      [1, "AML screening is pending", "/admin/compliance/aml"],
    ]);
  });

  it("says what an empty view means and summarises the range", () => {
    expect(sofEmptyCopy("rejected").title).toBe("No rejected cases");
    expect(sofEmptyCopy("pending").title).toBe("No pending source of funds cases");
    expect(sofRangeSummary(50, 50, 312)).toBe("51–100 of 312 cases");
  });
});
