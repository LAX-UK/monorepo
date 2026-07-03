import { describe, expect, it } from "vitest";
import { summarizeVeriffDecision } from "./kyc-decision-summary.js";

describe("summarizeVeriffDecision", () => {
  it("returns staff reason label from Veriff reason code", () => {
    const summary = summarizeVeriffDecision({
      verification: {
        status: "resubmission_requested",
        reasonCode: 203,
      },
    });
    expect(summary.decisionStatus).toBe("resubmission_requested");
    expect(summary.decisionReasonCode).toBe(203);
    expect(summary.decisionReasonLabel).toBe("Document not fully visible");
  });

  it("prefers provider reason text when present", () => {
    const summary = summarizeVeriffDecision({
      verification: {
        status: "declined",
        reason: "Document expired",
        reasonCode: 207,
      },
    });
    expect(summary.decisionReasonLabel).toBe("Document expired");
  });

  it("handles empty payload", () => {
    expect(summarizeVeriffDecision(null)).toEqual({
      decisionStatus: null,
      decisionReasonCode: null,
      decisionReasonLabel: null,
    });
  });
});
