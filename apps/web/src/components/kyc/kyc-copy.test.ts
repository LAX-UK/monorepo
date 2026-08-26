import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { describe, expect, it } from "vitest";
import {
  canStartKycVerification,
  effectiveKycPhase,
  isKycAwaitingDecision,
  isKycInReview,
  isKycSessionContinuable,
  kycComplianceIdentityPill,
  kycInitialPhase,
  kycLinkActionLabel,
  kycVerifyButtonLabel,
  resolveIdentityVerifyClientPhase,
} from "./kyc-copy";

function summary(overrides: Partial<KycStatusSummaryDto> = {}): KycStatusSummaryDto {
  return {
    status: "unverified",
    verifiedAt: null,
    latestSessionId: null,
    latestSessionStatus: null,
    feedback: {
      headline: "Not verified",
      detail: null,
      action: "start",
      reasonCode: null,
      decisionStatus: null,
      needsResubmit: false,
    },
    pendingExposure: { total: 0, currency: "GBP" },
    thresholdAmount: 1000,
    thresholdCurrency: "GBP",
    requiresKyc: false,
    ...overrides,
  };
}

describe("canStartKycVerification", () => {
  it("returns false when user is pending and not in an active client phase", () => {
    const s = summary({
      status: "pending",
      feedback: {
        headline: "In review",
        detail: null,
        action: "wait",
        reasonCode: null,
        decisionStatus: "review",
        needsResubmit: false,
      },
    });
    expect(canStartKycVerification(s, "idle")).toBe(false);
    expect(canStartKycVerification(s, "processing")).toBe(false);
  });

  it("returns true during in-flow client phases", () => {
    const s = summary({ status: "pending" });
    expect(canStartKycVerification(s, "in_flow")).toBe(true);
  });

  it("returns false when feedback action is wait", () => {
    const s = summary({
      feedback: {
        headline: "In review",
        detail: null,
        action: "wait",
        reasonCode: null,
        decisionStatus: "review",
        needsResubmit: false,
      },
    });
    expect(canStartKycVerification(s, "idle")).toBe(false);
  });

  it("returns true when session is created even if user status is pending", () => {
    const s = summary({
      status: "pending",
      latestSessionStatus: "created",
      feedback: {
        headline: "Verification started",
        detail: "Complete the document and selfie checks in the secure window.",
        action: "continue",
        reasonCode: null,
        decisionStatus: null,
        needsResubmit: false,
      },
    });
    expect(canStartKycVerification(s, "idle")).toBe(true);
    expect(kycInitialPhase(s)).toBe("idle");
    expect(effectiveKycPhase(s, "idle")).toBe("idle");
  });
});

describe("kycVerifyButtonLabel", () => {
  it("shows processing label when parent phase is processing", () => {
    expect(kycVerifyButtonLabel(summary({ status: "pending" }), "processing", false)).toBe(
      "Processing…",
    );
  });

  it("shows continue label for resubmit feedback", () => {
    const s = summary({
      feedback: {
        headline: "More information needed",
        detail: "Retake selfie",
        action: "continue",
        reasonCode: 202,
        decisionStatus: "resubmission_requested",
        needsResubmit: true,
      },
    });
    expect(kycVerifyButtonLabel(s, "needs_resubmit", false)).toBe("Continue verification");
  });
});

describe("effectiveKycPhase", () => {
  it("keeps in-flow client phase over server pending", () => {
    expect(effectiveKycPhase(summary({ status: "pending" }), "in_flow")).toBe("in_flow");
  });

  it("derives phase from summary when client is idle", () => {
    expect(effectiveKycPhase(summary({ status: "pending" }), "idle")).toBe("processing");
    expect(kycInitialPhase(summary({ status: "pending" }))).toBe("processing");
  });
});

describe("kycLinkActionLabel", () => {
  it("maps feedback actions to short and long labels", () => {
    expect(kycLinkActionLabel({ action: "continue", needsResubmit: true } as never, "short")).toBe(
      "Continue",
    );
    expect(kycLinkActionLabel({ action: "retry" } as never, "long")).toBe("Try again");
    expect(kycLinkActionLabel({ action: "wait" } as never, "long")).toBe("Verification in review");
    expect(kycLinkActionLabel({ action: "wait", needsResubmit: true } as never, "long")).toBe(
      "Continue verification",
    );
  });

  it("uses start copy when no feedback action is present", () => {
    expect(kycLinkActionLabel(null, "long")).toBe("Verify to continue bidding");
    expect(kycLinkActionLabel({ action: "start" } as never, "short")).toBe("Verify");
  });
});

describe("isKycInReview", () => {
  it("returns false for created session even when user status is pending", () => {
    const s = summary({
      status: "pending",
      latestSessionStatus: "created",
      feedback: {
        headline: "Verification started",
        detail: null,
        action: "continue",
        reasonCode: null,
        decisionStatus: null,
        needsResubmit: false,
      },
    });
    expect(isKycInReview(s)).toBe(false);
  });

  it("returns true when session is processing and feedback is wait", () => {
    const s = summary({
      status: "pending",
      latestSessionStatus: "processing",
      feedback: {
        headline: "In review",
        detail: null,
        action: "wait",
        reasonCode: null,
        decisionStatus: "review",
        needsResubmit: false,
      },
    });
    expect(isKycInReview(s)).toBe(true);
  });
});

describe("isKycSessionContinuable", () => {
  it("returns true for created session or continue feedback", () => {
    expect(
      isKycSessionContinuable(
        summary({
          latestSessionStatus: "created",
          feedback: {
            headline: "Verification started",
            detail: null,
            action: "continue",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: false,
          },
        }),
      ),
    ).toBe(true);
    expect(
      isKycSessionContinuable(
        summary({
          feedback: {
            headline: "More information needed",
            detail: null,
            action: "continue",
            reasonCode: 201,
            decisionStatus: "resubmission_requested",
            needsResubmit: true,
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns false when awaiting decision", () => {
    expect(
      isKycSessionContinuable(
        summary({
          status: "pending",
          latestSessionStatus: "processing",
          feedback: {
            headline: "In review",
            detail: null,
            action: "wait",
            reasonCode: null,
            decisionStatus: "review",
            needsResubmit: false,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("isKycAwaitingDecision", () => {
  it("returns true for processing session or pending without created session", () => {
    expect(isKycAwaitingDecision(summary({ latestSessionStatus: "processing" }))).toBe(true);
    expect(
      isKycAwaitingDecision(
        summary({ status: "pending", latestSessionStatus: "requires_input" as never }),
      ),
    ).toBe(true);
  });

  it("returns false for created session with pending user status", () => {
    expect(
      isKycAwaitingDecision(summary({ status: "pending", latestSessionStatus: "created" })),
    ).toBe(false);
  });
});

describe("resolveIdentityVerifyClientPhase", () => {
  it("keeps submitted after provider return while the summary still looks idle", () => {
    expect(
      resolveIdentityVerifyClientPhase({
        summary: summary({ status: "unverified", latestSessionStatus: "created" }),
        returnedFromProvider: true,
        currentPhase: "submitted",
      }),
    ).toBe("submitted");
  });

  it("does not drop in_flow back to idle on a stale summary refresh", () => {
    expect(
      resolveIdentityVerifyClientPhase({
        summary: summary({ status: "unverified", latestSessionStatus: null }),
        returnedFromProvider: false,
        currentPhase: "in_flow",
      }),
    ).toBe("in_flow");
  });

  it("follows a settled server status", () => {
    expect(
      resolveIdentityVerifyClientPhase({
        summary: summary({ status: "pending", latestSessionStatus: "processing" }),
        returnedFromProvider: true,
        currentPhase: "idle",
      }),
    ).toBe("submitted");
    expect(
      resolveIdentityVerifyClientPhase({
        summary: summary({
          status: "rejected",
          feedback: {
            headline: "Try again",
            detail: null,
            action: "retry",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: true,
          },
        }),
        returnedFromProvider: true,
        currentPhase: "submitted",
      }),
    ).toBe("needs_resubmit");
  });
});

describe("kycComplianceIdentityPill", () => {
  it("shows Started for continuable session", () => {
    const pill = kycComplianceIdentityPill(
      summary({
        status: "pending",
        latestSessionStatus: "created",
        feedback: {
          headline: "Verification started",
          detail: "Complete checks",
          action: "continue",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
      }),
    );
    expect(pill.value).toBe("Started");
    expect(pill.tone).toBe("warn");
  });

  it("shows In review for submitted session", () => {
    const pill = kycComplianceIdentityPill(
      summary({
        status: "pending",
        latestSessionStatus: "processing",
        feedback: {
          headline: "In review",
          detail: null,
          action: "wait",
          reasonCode: null,
          decisionStatus: "review",
          needsResubmit: false,
        },
      }),
    );
    expect(pill.value).toBe("In review");
    expect(pill.tone).toBe("info");
  });
});
