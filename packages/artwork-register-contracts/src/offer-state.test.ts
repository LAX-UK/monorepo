import { describe, expect, it } from "vitest";
import {
  OFFER_STATES,
  OFFER_TRANSITIONS,
  type OfferRef,
  type OfferState,
  nextOfferStates,
  transitionOffer,
} from "./offer-state.js";

const shop: OfferRef = { kind: "shop_artwork", id: "a1" };
const lot: OfferRef = { kind: "bid_lot", id: "l1" };
const deal: OfferRef = { kind: "private_sale", id: "p1" };

describe("transitionOffer", () => {
  it("offers a held artwork in one place with that place's reference", () => {
    expect(transitionOffer("held", "lax_art", shop)).toEqual({
      ok: true,
      state: "lax_art",
      ref: shop,
    });
    expect(transitionOffer("held", "bid_sale", lot).ok).toBe(true);
    expect(transitionOffer("held", "private_sale", deal).ok).toBe(true);
  });

  it("moves between places only by withdrawing first", () => {
    expect(transitionOffer("lax_art", "bid_sale", lot)).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(transitionOffer("bid_sale", "lax_art", shop)).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(transitionOffer("lax_art", "private_sale", deal).ok).toBe(false);

    expect(transitionOffer("lax_art", "withdrawn", null)).toEqual({
      ok: true,
      state: "withdrawn",
      ref: null,
    });
    expect(transitionOffer("withdrawn", "bid_sale", lot).ok).toBe(true);
  });

  it("lets an unsold or withdrawn artwork return to held", () => {
    expect(transitionOffer("bid_sale", "held", null).ok).toBe(true);
    expect(transitionOffer("withdrawn", "held", null).ok).toBe(true);
  });

  it("sells from a place, never straight from held or withdrawn", () => {
    expect(transitionOffer("lax_art", "sold", shop).ok).toBe(true);
    expect(transitionOffer("bid_sale", "sold", lot).ok).toBe(true);
    expect(transitionOffer("held", "sold", null)).toEqual({ ok: false, reason: "not_allowed" });
    expect(transitionOffer("withdrawn", "sold", null)).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it("treats sold as terminal", () => {
    for (const to of OFFER_STATES) {
      expect(transitionOffer("sold", to, null)).toEqual({ ok: false, reason: "sold_is_terminal" });
    }
    expect(nextOfferStates("sold")).toEqual([]);
  });

  it("refuses a move to the state it is already in", () => {
    expect(transitionOffer("held", "held", null)).toEqual({ ok: false, reason: "same_state" });
    expect(transitionOffer("lax_art", "lax_art", shop)).toEqual({
      ok: false,
      reason: "same_state",
    });
  });

  it("requires the reference of the place being offered", () => {
    expect(transitionOffer("held", "lax_art", null)).toEqual({
      ok: false,
      reason: "reference_required",
    });
    expect(transitionOffer("held", "bid_sale", shop)).toEqual({
      ok: false,
      reason: "reference_wrong_kind",
    });
  });

  it("drops the reference when the artwork leaves a place", () => {
    expect(transitionOffer("lax_art", "held", shop)).toEqual({
      ok: false,
      reason: "reference_not_allowed",
    });
    expect(transitionOffer("lax_art", "withdrawn", shop).ok).toBe(false);
  });

  it("lets a sale keep the reference of the place that closed it", () => {
    expect(transitionOffer("bid_sale", "sold", lot)).toEqual({ ok: true, state: "sold", ref: lot });
    expect(transitionOffer("bid_sale", "sold", null)).toEqual({
      ok: true,
      state: "sold",
      ref: null,
    });
  });
});

describe("offer transition table", () => {
  it("never lets one place reach another directly", () => {
    const places: OfferState[] = ["lax_art", "bid_sale", "private_sale"];
    for (const from of places) {
      for (const to of places) {
        expect(OFFER_TRANSITIONS[from]).not.toContain(to);
      }
    }
  });

  it("only offers an artwork from held or withdrawn", () => {
    for (const from of OFFER_STATES) {
      const offersAPlace = OFFER_TRANSITIONS[from].some((to) =>
        ["lax_art", "bid_sale", "private_sale"].includes(to),
      );
      expect(offersAPlace).toBe(from === "held" || from === "withdrawn");
    }
  });
});
