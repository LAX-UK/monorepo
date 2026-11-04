import { describe, expect, it } from "vitest";
import type { OfferRef, OfferState } from "./offer-state.js";
import {
  WHERE_IT_IS_CHIPS,
  WHERE_IT_IS_KEYS,
  WITHDRAWN_DISPLAY_DAYS,
  type WhereItIsInput,
  deriveWhereItIs,
} from "./where-it-is.js";

const NOW = new Date("2026-11-04T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const shop: OfferRef = { kind: "shop_artwork", id: "a" };
const lot: OfferRef = { kind: "bid_lot", id: "l" };
const deal: OfferRef = { kind: "private_sale", id: "p" };

const where = (
  state: OfferState,
  ref: OfferRef | null = null,
  over: Partial<WhereItIsInput> = {},
) => deriveWhereItIs({ offer: { state, ref }, now: NOW, ...over });

describe("chips", () => {
  it("has one chip per place with the words from the design", () => {
    expect(WHERE_IT_IS_KEYS.map((k) => WHERE_IT_IS_CHIPS[k].label)).toEqual([
      "Not offered",
      "Draft on lax.art",
      "On lax.art",
      "Draft lot in LAX Bid",
      "In a LAX Bid sale",
      "In a private sale",
      "Withdrawn",
      "Sold",
    ]);
  });

  it("draws a hollow marker for what buyers cannot see and a filled one for what they can", () => {
    expect(WHERE_IT_IS_CHIPS.not_offered.marker).toBe("hollow");
    expect(WHERE_IT_IS_CHIPS.draft_lax_art.marker).toBe("hollow");
    expect(WHERE_IT_IS_CHIPS.draft_bid_lot.marker).toBe("hollow");
    expect(WHERE_IT_IS_CHIPS.lax_art.marker).toBe("filled");
    expect(WHERE_IT_IS_CHIPS.bid_sale.marker).toBe("filled");
    expect(WHERE_IT_IS_CHIPS.private_sale.marker).toBe("filled");
    expect(WHERE_IT_IS_CHIPS.sold.marker).toBe("check");
    expect(WHERE_IT_IS_CHIPS.withdrawn.tone).toBe("warning");
  });

  it("gives no two places the same words", () => {
    const labels = WHERE_IT_IS_KEYS.map((k) => WHERE_IT_IS_CHIPS[k].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("deriveWhereItIs", () => {
  it("reads the register's published places", () => {
    expect(where("lax_art", shop).key).toBe("lax_art");
    expect(where("bid_sale", lot).key).toBe("bid_sale");
    expect(where("private_sale", deal).key).toBe("private_sale");
  });

  it("reads a held artwork as Not offered", () => {
    expect(where("held").key).toBe("not_offered");
  });

  it("reads a held artwork from its linked drafts, a draft lot first", () => {
    expect(where("held", null, { hasLaxArtDraft: true }).key).toBe("draft_lax_art");
    expect(where("held", null, { hasBidDraftLot: true }).key).toBe("draft_bid_lot");
    expect(where("held", null, { hasLaxArtDraft: true, hasBidDraftLot: true }).key).toBe(
      "draft_bid_lot",
    );
  });

  it("does not let a draft hide a published place or a sale", () => {
    const drafts = { hasLaxArtDraft: true, hasBidDraftLot: true };
    expect(where("lax_art", shop, drafts).key).toBe("lax_art");
    expect(where("sold", null, drafts).key).toBe("sold");
  });

  it("says where it was sold", () => {
    expect(where("sold", shop)).toMatchObject({
      soldWhere: "lax_art",
      soldWhereLabel: "On lax.art",
    });
    expect(where("sold", lot)).toMatchObject({
      soldWhere: "bid_sale",
      soldWhereLabel: "In LAX Bid",
    });
    expect(where("sold", deal)).toMatchObject({
      soldWhere: "private_sale",
      soldWhereLabel: "In a private sale",
    });
    expect(where("sold", null)).toMatchObject({
      soldWhere: "gallery",
      soldWhereLabel: "In the gallery, per Zoho",
    });
  });

  describe("withdrawn", () => {
    const at = (days: number) => new Date(NOW.getTime() - days * DAY);

    it("shows where it was withdrawn from and when it stops showing", () => {
      const result = where("withdrawn", null, { withdrawn: { at: at(2), from: "bid_sale" } });
      expect(result).toMatchObject({
        key: "withdrawn",
        from: "bid_sale",
        showUntil: new Date(at(2).getTime() + WITHDRAWN_DISPLAY_DAYS * DAY),
      });
    });

    it("stays for 30 days, then reads Not offered again", () => {
      const withdrawn = (days: number) => ({ withdrawn: { at: at(days), from: null } });
      expect(where("withdrawn", null, withdrawn(29.99)).key).toBe("withdrawn");
      expect(where("withdrawn", null, withdrawn(30)).key).toBe("not_offered");
      expect(where("withdrawn", null, withdrawn(90)).key).toBe("not_offered");
    });

    it("reads the drafts once the 30 days are over", () => {
      const old = { withdrawn: { at: at(31), from: null } };
      expect(where("withdrawn", null, { ...old, hasLaxArtDraft: true }).key).toBe("draft_lax_art");
      expect(where("withdrawn", null, { ...old, hasBidDraftLot: true }).key).toBe("draft_bid_lot");
    });

    it("stays Withdrawn, with no end date, when nothing says when it happened", () => {
      expect(where("withdrawn")).toMatchObject({ key: "withdrawn", from: null, showUntil: null });
    });
  });

  it("gives the same answer for the same input", () => {
    const input = { offer: { state: "withdrawn" as const, ref: null }, now: NOW };
    expect(deriveWhereItIs(input)).toEqual(deriveWhereItIs(input));
  });
});
