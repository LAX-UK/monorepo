import { evaluateBidPolicies } from "@/lib/bid/evaluate-bid-policies";
import { defaultBidPolicies } from "@/lib/bid/policies";
import type { SessionUser } from "@/lib/data/contracts";
import { describe, expect, it } from "vitest";
import { policyContext } from "./policy-test-context";
import type { SaleRegistrationBidGateContext } from "./types";

const client: SessionUser = {
  id: "user-1",
  email: "buyer@example.com",
  name: "Buyer",
  role: "client",
  emailVerified: false,
  kycStatus: "unverified",
};

const registrationGate: SaleRegistrationBidGateContext = {
  saleId: "sale-1",
  requiresRegistration: true,
  actingEntityId: "le-1",
  registrationStatus: null,
  approvedBidLimit: null,
  buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" }],
  myRegistrations: [],
  kycApproved: false,
};

function winner(over: Parameters<typeof policyContext>[0]) {
  return evaluateBidPolicies(defaultBidPolicies, policyContext(over));
}

describe("defaultBidPolicies precedence", () => {
  it("keeps ended lots on the terminal blocker instead of a sign-in CTA", () => {
    const decision = winner({
      user: null,
      lotStatus: "ended",
      biddingLifecycle: { kind: "endedSold" },
    });
    expect(decision).toMatchObject({ kind: "block", viewId: "not-live:endedSold" });
  });

  it("blocks a suspended buyer-agent before sale registration or email recovery", () => {
    const decision = winner({
      user: { ...client, suspended: true },
      strictBidEligibilityEnabled: true,
      saleRegistrationBidGate: registrationGate,
    });
    expect(decision).toMatchObject({ kind: "block", viewId: "suspended" });
  });

  it("blocks a seller on their own lot before unverified-email recovery", () => {
    const decision = winner({
      user: client,
      isOwnLot: true,
      strictBidEligibilityEnabled: true,
    });
    expect(decision).toMatchObject({ kind: "block", viewId: "seller-own-lot" });
  });

  it("asks guests to sign in before recoverable eligibility blockers", () => {
    const decision = winner({
      user: null,
      lotStatus: "active",
      strictBidEligibilityEnabled: true,
    });
    expect(decision).toMatchObject({ kind: "block", viewId: "not-signed-in" });
  });

  it("blocks unverified email before sale registration when both apply", () => {
    const decision = winner({
      user: client,
      strictBidEligibilityEnabled: true,
      saleRegistrationBidGate: registrationGate,
    });
    expect(decision).toMatchObject({ kind: "block", viewId: "email-verification-required" });
  });
});
