import { describe, expect, it } from "vitest";
import { NO_OFFER_LINKS, bidLotUrl, blockerLink } from "./offer-at-auction-links";

const LOT = "44444444-4444-4444-8444-444444444444";
const ARTWORK = "11111111-1111-4111-8111-111111111111";
const links = { bidAdminUrl: "https://bid.example/admin/", zohoUrl: "https://crm.example/p/1" };
const assessment = { artworkId: ARTWORK, holdingLotId: LOT };

const blocker = (target: string, label = "Go") =>
  ({ message: "Reason.", link: { label, target } }) as never;

describe("bidLotUrl", () => {
  it("opens the lot in Bid admin for a person who can open it", () => {
    expect(bidLotUrl("https://bid.example/admin", LOT)).toBe(
      `https://bid.example/admin/lots/${LOT}`,
    );
    expect(bidLotUrl("https://bid.example/admin/", LOT)).toBe(
      `https://bid.example/admin/lots/${LOT}`,
    );
  });

  it("gives nothing to a person who cannot", () => {
    expect(bidLotUrl(null, LOT)).toBeNull();
  });
});

describe("blockerLink", () => {
  it("links a Bid sale to its lot, in a new tab", () => {
    expect(blockerLink(blocker("bid_lot", "Open lot in LAX Bid"), assessment, links)).toEqual({
      label: "Open lot in LAX Bid",
      href: `https://bid.example/admin/lots/${LOT}`,
      external: true,
    });
  });

  it("leaves out a link the person cannot follow", () => {
    expect(blockerLink(blocker("bid_lot"), assessment, NO_OFFER_LINKS)).toBeNull();
    expect(
      blockerLink(blocker("bid_lot"), { ...assessment, holdingLotId: null }, links),
    ).toBeNull();
    expect(blockerLink(blocker("zoho_record"), assessment, NO_OFFER_LINKS)).toBeNull();
  });

  it("links Zoho and the lax.art artwork", () => {
    expect(blockerLink(blocker("zoho_record"), assessment, links)).toMatchObject({
      href: "https://crm.example/p/1",
      external: true,
    });
    expect(blockerLink(blocker("lax_art_listing"), assessment, links)).toEqual({
      label: "Go",
      href: `/artworks/${ARTWORK}`,
      external: false,
    });
  });

  it("has no link where the reason has none", () => {
    expect(
      blockerLink({ message: "Prints are sold in runs.", link: null }, assessment, links),
    ).toBeNull();
    expect(blockerLink(blocker("private_sale"), assessment, links)).toBeNull();
  });
});
