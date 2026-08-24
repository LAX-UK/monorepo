import type { SessionUser } from "@/lib/data/contracts";
import { describe, expect, it } from "vitest";
import { policyContext } from "./policy-test-context";
import { strictEligibilityPolicy } from "./strict-eligibility.policy";

const approvedUser: SessionUser = {
  id: "user-1",
  email: "buyer@example.com",
  name: "Buyer",
  role: "client",
  emailVerified: true,
  kycStatus: "approved",
};

describe("strictEligibilityPolicy", () => {
  it("preserves legacy eligibility when the rollout is disabled", () => {
    expect(
      strictEligibilityPolicy.evaluate(
        policyContext({
          user: { ...approvedUser, emailVerified: false, kycStatus: "unverified" },
          strictBidEligibilityEnabled: false,
        }),
      ),
    ).toEqual({ kind: "allow" });
  });

  it("prioritizes email verification over KYC", () => {
    const decision = strictEligibilityPolicy.evaluate(
      policyContext({
        user: { ...approvedUser, emailVerified: false, kycStatus: "unverified" },
        strictBidEligibilityEnabled: true,
      }),
    );
    expect(decision).toMatchObject({ kind: "block", viewId: "email-verification-required" });
    if (decision.kind !== "block") return;
    expect(decision.presentation.tone).toBe("warning");
    expect(decision.presentation.title).toBe("Verify your email to bid");
    expect(decision.presentation.action).toMatchObject({
      kind: "email",
      email: "buyer@example.com",
    });
  });

  it.each(["unverified", "pending", "rejected"] as const)(
    "blocks %s KYC with a contextual lot return link",
    (kycStatus) => {
      const decision = strictEligibilityPolicy.evaluate(
        policyContext({
          user: { ...approvedUser, kycStatus },
          strictBidEligibilityEnabled: true,
        }),
      );
      expect(decision).toMatchObject({ kind: "block", viewId: "strict-kyc-required" });
      if (decision.kind !== "block") return;
      expect(decision.presentation.tone).toBe("warning");
      expect(decision.presentation.title).toBe("Identity verification required");
      expect(decision.presentation.detail).toBe(
        "Your identity must be approved before you can place bids.",
      );
      expect(decision.presentation.action).toMatchObject({
        kind: "link",
        href: "/onboarding/identity?next=%2Flot%2Ftest-lot%2Flot1&source=bid_gate&lot=lot1",
      });
    },
  );

  it("allows an email-verified, KYC-approved client", () => {
    expect(
      strictEligibilityPolicy.evaluate(
        policyContext({ user: approvedUser, strictBidEligibilityEnabled: true }),
      ),
    ).toEqual({ kind: "allow" });
  });
});
