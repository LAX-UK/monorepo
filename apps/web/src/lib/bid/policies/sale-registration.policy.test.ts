import { saleRegistrationPolicy } from "@/lib/bid/policies/sale-registration.policy";
import type { BidPolicyContext, SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
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
  const gate = (
    registrationStatus: SaleRegistrationBidGateContext["registrationStatus"],
  ): SaleRegistrationBidGateContext => ({
    saleId: "sale-1",
    requiresRegistration: true,
    actingEntityId: "le-1",
    registrationStatus,
    approvedBidLimit: null,
    buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" }],
    myRegistrations: [],
    kycApproved: true,
  });

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
    if (d.kind === "block") expect(d.viewId).toBe("sale-registration-pending");
  });

  it.each([
    {
      status: "required" as const,
      viewId: "sale-registration-required",
      action: "panel",
      hasContent: true,
    },
    {
      status: "pending" as const,
      viewId: "sale-registration-pending",
      action: "status",
      hasContent: false,
    },
    {
      status: "rejected" as const,
      viewId: "sale-registration-rejected",
      action: "panel",
      hasContent: true,
    },
  ])("presents $status registration state", ({ status, viewId, action, hasContent }) => {
    const d = saleRegistrationPolicy.evaluate({
      ...baseCtx,
      saleRegistrationBidGate: gate(status),
    });

    expect(d).toMatchObject({
      kind: "block",
      viewId,
      presentation: {
        action: { kind: action },
      },
    });
    if (d.kind === "block") {
      expect(d.presentation.preview).toMatch(/one-time bid.*auto-bid/i);
      expect(Boolean(d.presentation.content)).toBe(hasContent);
    }
  });
});
