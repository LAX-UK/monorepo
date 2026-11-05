import { describe, expect, it } from "vitest";
import { type AuctionOfferListing, auctionOfferBlockers } from "./auction-offer.js";
import type { ArtworkRegisterEntry } from "./entry.js";

type Facts = Pick<ArtworkRegisterEntry, "kind" | "offer" | "catalogueStatus">;

const entry = (over: Partial<Facts> = {}): Facts => ({
  kind: "original",
  offer: { state: "held", ref: null },
  catalogueStatus: "Available",
  ...over,
});

const listing = (over: Partial<AuctionOfferListing> = {}): AuctionOfferListing => ({
  live: true,
  markedSold: false,
  openOriginalSale: false,
  ...over,
});

const reasons = (facts: Facts, linked: AuctionOfferListing | null) =>
  auctionOfferBlockers(facts, linked).map((blocker) => blocker.reason);

describe("auctionOfferBlockers", () => {
  it("lets a held or withdrawn original with no listing go", () => {
    expect(reasons(entry(), null)).toEqual([]);
    expect(reasons(entry({ offer: { state: "withdrawn", ref: null } }), null)).toEqual([]);
  });

  it("lets an original that is live through a linked listing go: the listing is taken down", () => {
    const live = entry({ offer: { state: "lax_art", ref: { kind: "shop_artwork", id: "a" } } });
    expect(reasons(live, listing())).toEqual([]);
  });

  it("refuses a lax.art state that no linked listing explains", () => {
    const live = entry({ offer: { state: "lax_art", ref: { kind: "shop_artwork", id: "a" } } });
    expect(reasons(live, null)).toEqual(["live_on_lax_art"]);
  });

  it("refuses a print and says why", () => {
    expect(reasons(entry({ kind: "print" }), null)).toEqual(["print"]);
  });

  it("refuses an artwork sold through LAX, in the gallery, or marked sold on lax.art", () => {
    const sold = (ref: { kind: "bid_lot" | "gallery_sale"; id: string }) =>
      entry({ offer: { state: "sold", ref } });
    expect(reasons(sold({ kind: "bid_lot", id: "l" }), null)).toEqual(["sold_through_lax"]);
    expect(reasons(sold({ kind: "gallery_sale", id: "z" }), null)).toEqual(["sold_in_gallery"]);
    expect(reasons(entry(), listing({ markedSold: true }))).toEqual(["sold_through_lax"]);
  });

  it("refuses an artwork Zoho already shows as sold, before the sync has moved it", () => {
    expect(reasons(entry({ catalogueStatus: "Sold" }), null)).toEqual(["sold_in_gallery"]);
  });

  it("refuses an artwork offered somewhere else", () => {
    expect(
      reasons(entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "l" } } }), null),
    ).toEqual(["in_bid_sale"]);
    expect(
      reasons(
        entry({ offer: { state: "private_sale", ref: { kind: "private_sale", id: "p" } } }),
        null,
      ),
    ).toEqual(["in_private_sale"]);
  });

  it("refuses while a buyer holds the original on lax.art", () => {
    expect(reasons(entry(), listing({ openOriginalSale: true }))).toEqual(["buyer_holds"]);
  });

  it("refuses an artwork Zoho shows as reserved, beside any place that holds it", () => {
    expect(reasons(entry({ catalogueStatus: "Reserved" }), null)).toEqual(["reserved_in_zoho"]);
    expect(
      reasons(
        entry({
          catalogueStatus: "Reserved",
          offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "l" } },
        }),
        null,
      ),
    ).toEqual(["in_bid_sale", "reserved_in_zoho"]);
  });

  it("gives each reason its words and link", () => {
    const [blocker] = auctionOfferBlockers(entry({ catalogueStatus: "Reserved" }), null);
    expect(blocker?.message).toMatch(/reserved/);
    expect(blocker?.link?.target).toBe("zoho_record");
  });
});
