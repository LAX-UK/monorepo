import type { ISaleRegistrationBidReader } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { SaleRegistrationBidGate } from "./sale-registration-bid.gate.js";

function gateWith(registration: { status: string; bidLimit?: string | null } | null) {
  const reader = {
    findRegistration: async () => registration,
  } as unknown as ISaleRegistrationBidReader;
  return new SaleRegistrationBidGate(reader);
}

const input = {
  saleId: "sale-1",
  placedByUserId: "u1",
  buyerLegalEntityId: "le-1",
  memberRole: "buyer_agent" as const,
  effectiveAmount: 500,
  operatorBypass: false,
};

describe("SaleRegistrationBidGate refusals", () => {
  it("asks an unregistered agent to register", async () => {
    const r = await gateWith(null).assertCanBid(input);
    expect(r._unsafeUnwrapErr()).toMatchObject({ code: "sale_registration_required" });
  });

  it("tells an agent whose registration is pending to wait", async () => {
    const r = await gateWith({ status: "pending" }).assertCanBid(input);
    expect(r._unsafeUnwrapErr()).toMatchObject({ code: "sale_registration_pending" });
  });

  it("asks a declined agent to register again, carrying the status", async () => {
    const r = await gateWith({ status: "declined" }).assertCanBid(input);
    expect(r._unsafeUnwrapErr()).toMatchObject({
      code: "sale_registration_required",
      details: { registration: "declined" },
    });
  });

  it("names the room under the registration limit", async () => {
    const r = await gateWith({ status: "approved", bidLimit: "300.00" }).assertCanBid(input);
    expect(r._unsafeUnwrapErr()).toMatchObject({
      code: "bid_limit_exceeded",
      details: { available: "300.00" },
    });
  });
});
