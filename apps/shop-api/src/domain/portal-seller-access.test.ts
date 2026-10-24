import { describe, expect, it } from "vitest";
import { type PortalSellerAccessFacts, decidePortalSellerAccess } from "./portal-seller-access.js";

const buyer: PortalSellerAccessFacts = {
  saleAuthority: [],
  hasSaleAuthorityRequest: false,
  hasPayout: false,
  hasSalesStatement: false,
  hasLinkedArtist: false,
  payoutsEnabled: true,
};

describe("decidePortalSellerAccess", () => {
  it("offers a plain buyer nothing", () => {
    expect(decidePortalSellerAccess(buyer)).toEqual({
      editions: false,
      payouts: false,
      artist: false,
    });
  });

  it("does not treat a collector's owned edition as a seller", () => {
    const access = decidePortalSellerAccess({
      ...buyer,
      saleAuthority: [{ lastGrantAt: null, authorisedCount: 0 }],
    });
    expect(access).toEqual({ editions: false, payouts: false, artist: false });
  });

  it("offers editions once staff granted authority or editions are authorised", () => {
    expect(
      decidePortalSellerAccess({
        ...buyer,
        saleAuthority: [{ lastGrantAt: "2026-01-01T00:00:00.000Z", authorisedCount: 0 }],
      }).editions,
    ).toBe(true);
    expect(
      decidePortalSellerAccess({
        ...buyer,
        saleAuthority: [{ lastGrantAt: null, authorisedCount: 2 }],
      }).editions,
    ).toBe(true);
  });

  it("offers editions and payouts to someone who asked for sale authority", () => {
    expect(decidePortalSellerAccess({ ...buyer, hasSaleAuthorityRequest: true })).toEqual({
      editions: true,
      payouts: true,
      artist: false,
    });
  });

  it("offers payouts for an existing payout or sales statement without edition access", () => {
    expect(decidePortalSellerAccess({ ...buyer, hasPayout: true }).payouts).toBe(true);
    expect(decidePortalSellerAccess({ ...buyer, hasSalesStatement: true }).payouts).toBe(true);
  });

  it("never offers payouts when payouts are switched off", () => {
    expect(
      decidePortalSellerAccess({
        ...buyer,
        payoutsEnabled: false,
        hasSaleAuthorityRequest: true,
        hasPayout: true,
      }),
    ).toEqual({ editions: true, payouts: false, artist: false });
  });

  it("reports a linked artist profile", () => {
    expect(decidePortalSellerAccess({ ...buyer, hasLinkedArtist: true }).artist).toBe(true);
  });
});
