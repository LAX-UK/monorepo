import { describe, expect, it } from "vitest";
import type { OfferRef, OfferState } from "./offer-state.js";
import {
  WHERE_IT_IS_CHIPS,
  WHERE_IT_IS_KEYS,
  WITHDRAWN_DISPLAY_DAYS,
  type WhereItIsInput,
  deriveWhereItIs,
  lastMoveInto,
  offerMovesOf,
  withdrawalOf,
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
    expect(where("sold", { kind: "gallery_sale", id: "z-1" })).toMatchObject({
      soldWhere: "gallery",
      soldWhereLabel: "In the gallery, per Zoho",
    });
  });

  it("reads a sold row that records no place as plain Sold, not as the gallery", () => {
    expect(where("sold", null)).toMatchObject({
      key: "sold",
      soldWhere: "unknown",
      soldWhereLabel: null,
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

describe("reading the offer's history", () => {
  const moved = (from: string | null, to: string, day: number) => ({
    type: "offer_moved",
    payload: { from: from ? { state: from } : null, to: { state: to } },
    createdAt: new Date(NOW.getTime() - day * DAY),
  });

  it("keeps only offer moves that name where the artwork went", () => {
    const events = [
      { type: "created", payload: {}, createdAt: NOW },
      moved("held", "lax_art", 9),
      { type: "offer_moved", payload: { to: "lax_art" }, createdAt: NOW },
      moved("lax_art", "withdrawn", 3),
    ];
    expect(offerMovesOf(events).map((m) => [m.from, m.to])).toEqual([
      ["held", "lax_art"],
      ["lax_art", "withdrawn"],
    ]);
  });

  it("finds the latest move into a state", () => {
    const moves = offerMovesOf([
      moved("held", "withdrawn", 20),
      moved("withdrawn", "lax_art", 10),
      moved("lax_art", "withdrawn", 2),
    ]);
    expect(lastMoveInto(moves, "withdrawn")?.at).toEqual(new Date(NOW.getTime() - 2 * DAY));
    expect(lastMoveInto(moves, "sold")).toBeUndefined();
  });

  it("says when and from where a withdrawn artwork was withdrawn", () => {
    const moves = offerMovesOf([moved("bid_sale", "withdrawn", 4)]);
    expect(withdrawalOf(moves, "withdrawn")).toEqual({
      at: new Date(NOW.getTime() - 4 * DAY),
      from: "bid_sale",
    });
  });

  it("does not name a place it was not withdrawn from, and says nothing for other states", () => {
    const moves = offerMovesOf([moved("held", "withdrawn", 4)]);
    expect(withdrawalOf(moves, "withdrawn")?.from).toBeNull();
    expect(withdrawalOf(moves, "held")).toBeNull();
    expect(withdrawalOf([], "withdrawn")).toBeNull();
  });
});
