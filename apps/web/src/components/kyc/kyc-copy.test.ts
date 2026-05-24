import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { describe, expect, it } from "vitest";
import {
  canStartKycVerification,
  effectiveKycPhase,
  kycInitialPhase,
  kycLinkActionLabel,
  kycVerifyButtonLabel,
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
    expect(kycLinkActionLabel({ action: "wait" } as never, "short")).toBe("In review");
  });
});
