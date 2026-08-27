import { describe, expect, it } from "vitest";
import { kycThresholdPolicy } from "./kyc-threshold.policy";
import { policyContext } from "./policy-test-context";

describe("kycThresholdPolicy", () => {
  it("allows when KYC is not required", () => {
    expect(kycThresholdPolicy.evaluate(policyContext()).kind).toBe("allow");
  });

  it("does not treat feedback-only summaries as a threshold block", () => {
    expect(
      kycThresholdPolicy.evaluate(
        policyContext({
          kycBidGate: {
            requiresKyc: false,
            feedback: {
              headline: "In review",
              detail: null,
              action: "wait",
              reasonCode: null,
              decisionStatus: "review",
              needsResubmit: false,
            },
          },
        }),
      ).kind,
    ).toBe("allow");
  });

  it("blocks with a verification link when the threshold is met", () => {
    const decision = kycThresholdPolicy.evaluate(
      policyContext({
        kycBidGate: { requiresKyc: true, feedback: null },
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.viewId).toBe("kyc-threshold");
    expect(decision.presentation.tone).toBe("warning");
    expect(decision.presentation.title).toBe("Identity verification required");
    expect(decision.presentation.action).toMatchObject({
      kind: "link",
      href: "/onboarding/identity?next=%2Flot%2Ftest-lot%2Flot1&source=bid_gate&lot=lot1",
    });
  });
});
