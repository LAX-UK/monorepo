import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { describe, expect, it } from "vitest";

const base = {
  show: true,
  lotEligible: true,
  isAuthenticated: true,
  kycApproved: true,
  kycFeedback: null,
  loginNextPath: "/lot/x",
  dashboardHref: "/dashboard/condition-reports",
  published: null,
  buyerRequest: null,
  uiPhase: "idle" as const,
  submitErrorMessage: null,
};

describe("deriveConditionReportCardState", () => {
  it("prefers published PDF when buyer already has a request", () => {
    const state = deriveConditionReportCardState({
      ...base,
      published: { downloadUrl: "https://cdn.example.com/cr.pdf", summary: "Fine" },
      buyerRequest: {
        id: "r1",
        lotId: "lot-1",
        status: "pending",
        requestNote: null,
        responseNote: null,
        createdAt: new Date().toISOString(),
      },
    });
    expect(state?.kind).toBe("published");
  });

  it("returns null when buyer has any request and no published PDF", () => {
    const state = deriveConditionReportCardState({
      ...base,
      buyerRequest: {
        id: "r1",
        lotId: "lot-1",
        status: "pending",
        requestNote: null,
        responseNote: null,
        createdAt: new Date().toISOString(),
      },
    });
    expect(state).toBeNull();
  });

  it("returns null when buyer request is declined", () => {
    const state = deriveConditionReportCardState({
      ...base,
      buyerRequest: {
        id: "r1",
        lotId: "lot-1",
        status: "declined",
        requestNote: null,
        responseNote: "Unavailable",
        createdAt: new Date().toISOString(),
      },
    });
    expect(state).toBeNull();
  });

  it("returns canRequest when eligible and no request", () => {
    const state = deriveConditionReportCardState({ ...base });
    expect(state?.kind).toBe("canRequest");
  });

  it("returns null when show is false", () => {
    expect(deriveConditionReportCardState({ ...base, show: false })).toBeNull();
  });
});
