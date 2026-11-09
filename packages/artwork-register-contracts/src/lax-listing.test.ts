import { describe, expect, it } from "vitest";
import {
  type BidLotStatus,
  type BidSaleStatus,
  LAX_LISTING_KEYS,
  LAX_LISTING_LABEL,
  deriveBidSalePhase,
  laxListingKeyFor,
} from "./lax-listing.js";
import type { OfferRef, OfferState } from "./offer-state.js";
import { deriveWhereItIs } from "./where-it-is.js";

const NOW = new Date("2026-11-05T12:00:00Z");

const where = (state: OfferState, ref: OfferRef | null = null, drafts = {}) =>
  deriveWhereItIs({ offer: { state, ref }, now: NOW, ...drafts });

describe("deriveBidSalePhase", () => {
  const phase = (lotStatus: BidLotStatus, saleStatus: BidSaleStatus | null) =>
    deriveBidSalePhase({ lotStatus, saleStatus, saleStartTime: null, now: NOW });

  it("is upcoming until the sale opens", () => {
    expect(phase("scheduled", "scheduled")).toBe("upcoming");
    expect(phase("draft", "draft")).toBe("upcoming");
    expect(phase("scheduled", null)).toBe("upcoming");
  });

  it("is live now for every lot of a sale that has started, on the block or waiting", () => {
    expect(phase("active", "active")).toBe("live_now");
    expect(phase("scheduled", "active")).toBe("live_now");
    expect(phase("active", "scheduled")).toBe("live_now");
  });

  it("is ended once the lot closes, even while the rest of the sale runs", () => {
    expect(phase("ended", "active")).toBe("ended");
    expect(phase("voided", "active")).toBe("ended");
    expect(phase("cancelled", "scheduled")).toBe("ended");
  });

  describe("from the sale's own start time", () => {
    const at = (
      saleStatus: BidSaleStatus,
      startTime: string,
      lotStatus: BidLotStatus = "scheduled",
    ) =>
      deriveBidSalePhase({ lotStatus, saleStatus, saleStartTime: new Date(startTime), now: NOW });

    it("is upcoming before the sale starts", () => {
      expect(at("scheduled", "2026-11-05T18:00:00Z")).toBe("upcoming");
    });

    it("is live now once the sale has started, with no active lot", () => {
      expect(at("scheduled", "2026-11-05T11:00:00Z")).toBe("live_now");
      expect(at("scheduled", "2026-11-05T12:00:00Z")).toBe("live_now");
    });

    it("flips exactly at the start time", () => {
      expect(at("scheduled", "2026-11-05T12:00:00.001Z")).toBe("upcoming");
      expect(at("scheduled", "2026-11-05T11:59:59.999Z")).toBe("live_now");
    });

    it("is upcoming for a scheduled sale with no start time given", () => {
      expect(
        deriveBidSalePhase({
          lotStatus: "scheduled",
          saleStatus: "scheduled",
          saleStartTime: null,
          now: NOW,
        }),
      ).toBe("upcoming");
    });

    it("is ended for an ended sale, whatever its start time", () => {
      expect(at("ended", "2026-11-05T11:00:00Z")).toBe("ended");
      expect(at("cancelled", "2026-11-05T11:00:00Z")).toBe("ended");
    });

    it("does not start a draft sale or a closed lot", () => {
      expect(at("draft", "2026-11-05T11:00:00Z")).toBe("upcoming");
      expect(at("scheduled", "2026-11-05T11:00:00Z", "ended")).toBe("ended");
    });
  });

  it("is ended once the sale ends or is cancelled", () => {
    expect(phase("scheduled", "ended")).toBe("ended");
    expect(phase("scheduled", "cancelled")).toBe("ended");
  });
});

describe("LAX_LISTING_LABEL", () => {
  it("holds exactly the Zoho picklist values, in picklist order", () => {
    expect(LAX_LISTING_KEYS.map((key) => LAX_LISTING_LABEL[key])).toEqual([
      "Not offered",
      "Draft on lax.art",
      "On lax.art",
      "Draft lot in LAX Bid",
      "In a LAX Bid sale — upcoming",
      "In a LAX Bid sale — live now",
      "In a LAX Bid sale — ended",
      "In a private sale",
      "Sold on lax.art",
      "Sold in LAX Bid",
      "Sold privately",
      "Sold in the gallery",
      "Sold",
      "Withdrawn",
    ]);
  });

  it("gives no two places the same words", () => {
    const labels = Object.values(LAX_LISTING_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("laxListingKeyFor", () => {
  it("reads every place the register can be in", () => {
    expect(laxListingKeyFor(where("held"), null)).toBe("not_offered");
    expect(laxListingKeyFor(where("held", null, { hasLaxArtDraft: true }), null)).toBe(
      "draft_lax_art",
    );
    expect(laxListingKeyFor(where("held", null, { hasBidDraftLot: true }), null)).toBe(
      "draft_bid_lot",
    );
    expect(laxListingKeyFor(where("lax_art", { kind: "shop_artwork", id: "a" }), null)).toBe(
      "lax_art",
    );
    expect(laxListingKeyFor(where("private_sale", { kind: "private_sale", id: "p" }), null)).toBe(
      "private_sale",
    );
    expect(laxListingKeyFor(where("withdrawn"), null)).toBe("withdrawn");
  });

  it("adds the Bid sale phase", () => {
    const inSale = where("bid_sale", { kind: "bid_lot", id: "l" });
    expect(laxListingKeyFor(inSale, "upcoming")).toBe("bid_sale_upcoming");
    expect(laxListingKeyFor(inSale, "live_now")).toBe("bid_sale_live_now");
    expect(laxListingKeyFor(inSale, "ended")).toBe("bid_sale_ended");
    expect(laxListingKeyFor(inSale, null)).toBe("bid_sale_upcoming");
  });

  it("says where a sale was made", () => {
    const sold = (ref: OfferRef | null) => laxListingKeyFor(where("sold", ref), null);
    expect(sold({ kind: "shop_artwork", id: "a" })).toBe("sold_lax_art");
    expect(sold({ kind: "bid_lot", id: "l" })).toBe("sold_bid_sale");
    expect(sold({ kind: "private_sale", id: "p" })).toBe("sold_private_sale");
    expect(sold({ kind: "gallery_sale", id: "z" })).toBe("sold_gallery");
    expect(sold(null)).toBe("sold");
  });
});
