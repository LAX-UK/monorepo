import type { SessionUser } from "@/lib/data/contracts";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { evaluateBidPolicies } from "../evaluate-bid-policies";
import { defaultBidPolicies } from "./index";
import type { BidPolicyContext, SaleRegistrationBidGateContext } from "./types";

const approvedBuyer: SessionUser = {
  id: "buyer-1",
  email: "buyer@example.com",
  name: "Buyer",
  role: "client",
  emailVerified: true,
  kycStatus: "approved",
};

const lot = {
  id: "lot-1",
  sellerId: "seller-1",
  status: "active",
  auctionType: "english",
} as Lot;

const registrationGate: SaleRegistrationBidGateContext = {
  saleId: "sale-1",
  requiresRegistration: true,
  actingEntityId: "entity-1",
  registrationStatus: "required",
  approvedBidLimit: null,
  buyerEntities: [{ id: "entity-1", displayName: "Agency", memberRole: "buyer_agent" }],
  myRegistrations: [],
  kycApproved: true,
};

function context(overrides: Partial<BidPolicyContext> = {}): BidPolicyContext {
  return {
    user: approvedBuyer,
    lot,
    lotStatus: "active",
    loginNextPath: "/lot/example/lot-1",
    biddingLifecycle: { kind: "live" },
    strictBidEligibilityEnabled: true,
    ...overrides,
  };
}

describe("defaultBidPolicies blocker matrix", () => {
  it.each([
    {
      name: "lifecycle before authentication",
      ctx: context({
        user: null,
        lotStatus: "scheduled",
        biddingLifecycle: { kind: "scheduled" },
      }),
      viewId: "not-live:scheduled",
    },
    {
      name: "authentication before account checks",
      ctx: context({ user: null }),
      viewId: "not-signed-in",
    },
    {
      name: "suspension before email and KYC",
      ctx: context({
        user: {
          ...approvedBuyer,
          suspended: true,
          emailVerified: false,
          kycStatus: "unverified",
        },
        saleRegistrationBidGate: registrationGate,
        isOwnLot: true,
      }),
      viewId: "suspended",
    },
    {
      name: "email before KYC",
      ctx: context({
        user: { ...approvedBuyer, emailVerified: false, kycStatus: "unverified" },
        saleRegistrationBidGate: registrationGate,
      }),
      viewId: "email-verification-required",
    },
    {
      name: "strict KYC before sale registration",
      ctx: context({
        user: { ...approvedBuyer, kycStatus: "unverified" },
        saleRegistrationBidGate: registrationGate,
      }),
      viewId: "strict-kyc-required",
    },
    {
      name: "threshold KYC before sale registration",
      ctx: context({
        user: { ...approvedBuyer, kycStatus: "unverified" },
        strictBidEligibilityEnabled: false,
        kycBidGate: { requiresKyc: true },
        saleRegistrationBidGate: registrationGate,
      }),
      viewId: "kyc-threshold",
    },
    {
      name: "sale registration before own-lot restriction",
      ctx: context({ saleRegistrationBidGate: registrationGate, isOwnLot: true }),
      viewId: "sale-registration-required",
    },
    {
      name: "own-lot before staff restriction",
      ctx: context({
        user: { ...approvedBuyer, role: "staff" },
        isOwnLot: true,
      }),
      viewId: "seller-own-lot",
    },
    {
      name: "staff restriction after buyer prerequisites",
      ctx: context({ user: { ...approvedBuyer, role: "staff" } }),
      viewId: "staff-no-bid",
    },
  ])("keeps $name", ({ ctx, viewId }) => {
    const decision = evaluateBidPolicies(defaultBidPolicies, ctx);

    expect(decision).toMatchObject({ kind: "block", viewId });
    if (decision.kind === "block") {
      expect(decision.presentation.title).not.toHaveLength(0);
      expect(decision.presentation.detail).toBeTruthy();
    }
  });

  it("allows an eligible buyer", () => {
    expect(evaluateBidPolicies(defaultBidPolicies, context())).toEqual({ kind: "allow" });
  });
});
