import type { SessionUser } from "@/lib/data/contracts";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { evaluateBidPolicies } from "../evaluate-bid-policies";
import { defaultBidPolicies } from "./index";
import { strictEligibilityPolicy } from "./strict-eligibility.policy";
import type { BidPolicyContext } from "./types";

const lot = { id: "lot-1", status: "active" } as Lot;
const approvedUser = {
  id: "user-1",
  email: "buyer@example.com",
  name: "Buyer",
  role: "client",
  emailVerified: true,
  kycStatus: "approved",
} as SessionUser;

function context(user: SessionUser, enabled = true): BidPolicyContext {
  return {
    user,
    lot,
    lotStatus: "active",
    loginNextPath: "/lot/example/lot-1",
    strictBidEligibilityEnabled: enabled,
  };
}

describe("strictEligibilityPolicy", () => {
  it("preserves legacy eligibility when rollout is disabled", () => {
    expect(
      strictEligibilityPolicy.evaluate(
        context({ ...approvedUser, emailVerified: false, kycStatus: "unverified" }, false),
      ),
    ).toEqual({ kind: "allow" });
  });

  it("prioritizes email verification over KYC", () => {
    const decision = strictEligibilityPolicy.evaluate(
      context({ ...approvedUser, emailVerified: false, kycStatus: "unverified" }),
    );
    expect(decision).toMatchObject({ kind: "block", viewId: "email-verification-required" });
    if (decision.kind === "block") render(decision.render());
    expect(screen.getByText("Verify your email to bid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification email" })).toBeEnabled();
  });

  it.each(["unverified", "pending", "rejected"] as const)(
    "blocks %s KYC with a contextual lot return link",
    (kycStatus) => {
      const decision = strictEligibilityPolicy.evaluate(context({ ...approvedUser, kycStatus }));
      expect(decision).toMatchObject({ kind: "block", viewId: "strict-kyc-required" });
      if (decision.kind === "block") render(decision.render());
      expect(
        screen.getByText("Your identity must be approved before you can place bids."),
      ).toBeInTheDocument();
      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        "/onboarding/identity?next=%2Flot%2Fexample%2Flot-1&source=bid_gate&lot=lot-1",
      );
    },
  );

  it("renders processing KYC as status-only feedback", () => {
    const decision = strictEligibilityPolicy.evaluate({
      ...context({ ...approvedUser, kycStatus: "pending" }),
      kycBidGate: {
        requiresKyc: true,
        feedback: {
          headline: "Verification in review",
          detail: "We are reviewing your submission.",
          action: "wait",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
      },
    });

    expect(decision).toMatchObject({
      kind: "block",
      presentation: { action: { kind: "status", label: "In review" } },
    });
    if (decision.kind === "block") render(decision.render());
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("allows an email-verified, KYC-approved client", () => {
    expect(strictEligibilityPolicy.evaluate(context(approvedUser))).toEqual({ kind: "allow" });
  });

  it("shows suspension before identity remediation for combined blocked states", () => {
    const decision = evaluateBidPolicies(
      defaultBidPolicies,
      context({
        ...approvedUser,
        suspended: true,
        emailVerified: false,
        kycStatus: "unverified",
      }),
    );

    expect(decision).toMatchObject({ kind: "block", viewId: "suspended" });
  });
});
