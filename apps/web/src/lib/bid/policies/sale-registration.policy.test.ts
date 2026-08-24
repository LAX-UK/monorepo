import { saleRegistrationPolicy } from "@/lib/bid/policies/sale-registration.policy";
import type { BidPolicyContext } from "@/lib/bid/policies/types";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

const lot = { id: "lot-1", sellerId: "seller-1" } as Lot;

const baseCtx: BidPolicyContext = {
  user: { id: "u1", email: "a@b.c", name: "A", role: "client" },
  lot,
  lotStatus: "active",
  loginNextPath: "/lot/x/1",
};

describe("saleRegistrationPolicy", () => {
  it("allows when gate is absent", () => {
    expect(saleRegistrationPolicy.evaluate(baseCtx).kind).toBe("allow");
  });

  it("allows when registration is approved", () => {
    const d = saleRegistrationPolicy.evaluate({
      ...baseCtx,
      saleRegistrationBidGate: {
        saleId: "sale-1",
        requiresRegistration: true,
        actingEntityId: "le-1",
        registrationStatus: "approved",
        approvedBidLimit: null,
        buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" }],
        myRegistrations: [{ buyerLegalEntityId: "le-1", status: "approved" }],
        kycApproved: true,
      },
    });
    expect(d.kind).toBe("allow");
  });

  it("blocks with pending copy", () => {
    const d = saleRegistrationPolicy.evaluate({
      ...baseCtx,
      saleRegistrationBidGate: {
        saleId: "sale-1",
        requiresRegistration: true,
        actingEntityId: "le-1",
        registrationStatus: "pending",
        approvedBidLimit: null,
        buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" }],
        myRegistrations: [{ buyerLegalEntityId: "le-1", status: "pending" }],
        kycApproved: true,
      },
    });
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("sale-registration-pending");
    expect(d.presentation.tone).toBe("info");
    expect(d.presentation.title).toBe("Registration pending");
    expect(d.presentation.action).toMatchObject({ kind: "status", label: "Awaiting approval" });
  });

  it("blocks missing registration with a panel action", () => {
    const d = saleRegistrationPolicy.evaluate({
      ...baseCtx,
      saleRegistrationBidGate: {
        saleId: "sale-1",
        requiresRegistration: true,
        actingEntityId: "le-1",
        registrationStatus: null,
        approvedBidLimit: null,
        buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" }],
        myRegistrations: [],
        kycApproved: true,
      },
    });
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.viewId).toBe("sale-registration-required");
    expect(d.presentation.tone).toBe("warning");
    expect(d.presentation.title).toBe("Register to bid");
    expect(d.presentation.action).toMatchObject({ kind: "panel", label: "Complete registration" });
  });
});
