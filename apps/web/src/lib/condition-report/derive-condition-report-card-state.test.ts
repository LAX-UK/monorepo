import { deriveConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { describe, expect, it } from "vitest";

const base = {
  show: true,
  isAuthenticated: true,
  emailVerified: true,
  userEmail: "buyer@example.com",
  kycStatus: "approved" as const,
  kycFeedback: null,
  loginNextPath: "/lot/x",
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

  it("returns emailVerificationRequired when KYC is approved but email is unverified", () => {
    const state = deriveConditionReportCardState({
      ...base,
      emailVerified: false,
      kycStatus: "approved",
      userEmail: "buyer@example.com",
    });
    expect(state).toEqual({
      kind: "emailVerificationRequired",
      loginNextPath: "/lot/x",
      email: "buyer@example.com",
    });
  });

  it("returns kycRequired when email is verified but KYC is pending", () => {
    const state = deriveConditionReportCardState({
      ...base,
      emailVerified: true,
      kycStatus: "pending",
      kycFeedback: "Complete identity verification",
    });
    expect(state).toEqual({
      kind: "kycRequired",
      loginNextPath: "/lot/x",
      feedback: "Complete identity verification",
    });
  });

  it("returns notSignedIn for unauthenticated viewers", () => {
    const state = deriveConditionReportCardState({
      ...base,
      isAuthenticated: false,
    });
    expect(state?.kind).toBe("notSignedIn");
  });

  it("returns null when show is false", () => {
    expect(deriveConditionReportCardState({ ...base, show: false })).toBeNull();
  });
});
