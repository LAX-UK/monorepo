import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  BID_AUTHORITY_ERROR_CODES,
  type BuyerAgentGrant,
  bidExceedsAuthority,
  decideBidAuthority,
  roleBidsThroughAuthorisation,
} from "./bid-authority.js";

const SALE = "sale-1";
const OTHER_SALE = "sale-2";

describe("decideBidAuthority", () => {
  it("refuses someone who is not a member", () => {
    expect(decideBidAuthority({ role: null, grants: [], saleId: SALE })).toEqual({
      allowed: false,
      role: null,
      reason: "not_member",
    });
  });

  it.each(["owner", "admin"] as const)("lets %s bid without an authorisation", (role) => {
    expect(decideBidAuthority({ role, grants: [], saleId: SALE })).toEqual({
      allowed: true,
      role,
      viaAuthorisation: false,
      bidLimit: null,
    });
  });

  it.each(["finance", "consignor", "viewer", "specialist", "staff"] as const)(
    "refuses %s even with an authorisation row",
    (role) => {
      const grants: BuyerAgentGrant[] = [{ saleId: null, bidLimit: null }];
      expect(decideBidAuthority({ role, grants, saleId: SALE })).toEqual({
        allowed: false,
        role,
        reason: "role_cannot_bid",
      });
    },
  );

  it("refuses a buyer agent without an authorisation", () => {
    expect(decideBidAuthority({ role: "buyer_agent", grants: [], saleId: SALE })).toEqual({
      allowed: false,
      role: "buyer_agent",
      reason: "authorisation_required",
    });
  });

  it("lets a buyer agent authorised for all sales bid on any sale", () => {
    const decision = decideBidAuthority({
      role: "buyer_agent",
      grants: [{ saleId: null, bidLimit: 5000 }],
      saleId: SALE,
    });
    expect(decision).toEqual({
      allowed: true,
      role: "buyer_agent",
      viaAuthorisation: true,
      bidLimit: 5000,
    });
  });

  it("refuses a buyer agent authorised only for another sale", () => {
    const decision = decideBidAuthority({
      role: "buyer_agent",
      grants: [{ saleId: OTHER_SALE, bidLimit: null }],
      saleId: SALE,
    });
    expect(decision).toMatchObject({ allowed: false, reason: "authorisation_required" });
  });

  it("prefers the sale's own authorisation over the all-sales one", () => {
    const decision = decideBidAuthority({
      role: "buyer_agent",
      grants: [
        { saleId: null, bidLimit: 2000 },
        { saleId: SALE, bidLimit: 9000 },
      ],
      saleId: SALE,
    });
    expect(decision).toMatchObject({ allowed: true, bidLimit: 9000 });
  });

  it("treats an authorisation with no limit as unlimited", () => {
    const decision = decideBidAuthority({
      role: "buyer_agent",
      grants: [{ saleId: SALE, bidLimit: null }],
      saleId: SALE,
    });
    expect(decision).toMatchObject({ allowed: true, bidLimit: null });
  });

  it("allows only owners and admins when nobody holds an authorisation", () => {
    for (const role of legalEntityMemberRoles) {
      const decision = decideBidAuthority({ role, grants: [], saleId: SALE });
      expect(decision.allowed).toBe(role === "owner" || role === "admin");
    }
  });
});

describe("bidExceedsAuthority", () => {
  const limited = decideBidAuthority({
    role: "buyer_agent",
    grants: [{ saleId: null, bidLimit: 1000 }],
    saleId: SALE,
  });

  it("allows bids up to the limit", () => {
    expect(bidExceedsAuthority(limited, 1000)).toBe(false);
  });

  it("flags bids above the limit", () => {
    expect(bidExceedsAuthority(limited, 1000.01)).toBe(true);
  });

  it("never flags an unlimited decision", () => {
    const owner = decideBidAuthority({ role: "owner", grants: [], saleId: SALE });
    expect(bidExceedsAuthority(owner, 1_000_000)).toBe(false);
  });
});

describe("roleBidsThroughAuthorisation", () => {
  it("is true only for buyer agents", () => {
    for (const role of legalEntityMemberRoles) {
      expect(roleBidsThroughAuthorisation(role)).toBe(role === "buyer_agent");
    }
  });
});

describe("BID_AUTHORITY_ERROR_CODES", () => {
  it("keeps the existing membership and buyer-agent codes", () => {
    expect(BID_AUTHORITY_ERROR_CODES.not_member).toBe("membership_required");
    expect(BID_AUTHORITY_ERROR_CODES.authorisation_required).toBe(
      "buyer_agent_authorisation_required",
    );
    expect(BID_AUTHORITY_ERROR_CODES.role_cannot_bid).toBe("bid_role_not_permitted");
  });
});
