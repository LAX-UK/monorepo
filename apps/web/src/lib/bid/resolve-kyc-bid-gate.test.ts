import { describe, expect, it } from "vitest";
import {
  KYC_STATUS_UNAVAILABLE_FEEDBACK,
  resolveKycBidGate,
  resolveKycSurfaceFeedback,
} from "./resolve-kyc-bid-gate";

const summary = {
  requiresKyc: false,
  feedback: {
    headline: "Not verified",
    detail: null,
    action: "start" as const,
    reasonCode: null,
    decisionStatus: null,
    needsResubmit: false,
  },
};

describe("resolveKycBidGate", () => {
  it("does not invent a gate when no summary is available", () => {
    expect(resolveKycBidGate({ summary: null })).toBeNull();
  });

  it("passes through a loaded summary", () => {
    expect(resolveKycBidGate({ summary: summary as never })).toEqual({
      requiresKyc: false,
      feedback: summary.feedback,
    });
  });

  it("fails closed when the verification read is unavailable", () => {
    expect(resolveKycBidGate({ summary: summary as never, unavailable: true })).toEqual({
      requiresKyc: true,
      feedback: KYC_STATUS_UNAVAILABLE_FEEDBACK,
    });
    expect(resolveKycSurfaceFeedback({ summary: null, unavailable: true })).toEqual(
      KYC_STATUS_UNAVAILABLE_FEEDBACK,
    );
  });
});
