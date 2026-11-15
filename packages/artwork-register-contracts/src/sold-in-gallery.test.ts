import { describe, expect, it } from "vitest";
import { OFFER_STATES, type OfferRef, type OfferState } from "./offer-state.js";
import {
  REOPEN_REASON_MAX_LENGTH,
  REOPEN_REFUSAL_MESSAGE,
  isReservedInZoho,
  isSoldInZoho,
  planGallerySale,
  reconcileZohoStatus,
  recordGallerySale,
  reopenGallerySale,
  reopenSold,
  soldWhere,
} from "./sold-in-gallery.js";

const shop: OfferRef = { kind: "shop_artwork", id: "a" };
const lot: OfferRef = { kind: "bid_lot", id: "l" };
const deal: OfferRef = { kind: "private_sale", id: "p" };
const gallery: OfferRef = { kind: "gallery_sale", id: "z-1" };
const offer = (state: OfferState, ref: OfferRef | null = null) => ({ state, ref });
const NOT_SOLD = OFFER_STATES.filter((s) => s !== "sold");

describe("Zoho status", () => {
  it("reads Sold and Reserved without caring about case or spaces", () => {
    expect(isSoldInZoho("Sold")).toBe(true);
    expect(isSoldInZoho(" sold ")).toBe(true);
    expect(isSoldInZoho("Available")).toBe(false);
    expect(isSoldInZoho(null)).toBe(false);
    expect(isSoldInZoho(undefined)).toBe(false);
    expect(isReservedInZoho("RESERVED")).toBe(true);
    expect(isReservedInZoho("Sold")).toBe(false);
    expect(isReservedInZoho("")).toBe(false);
  });
});

describe("soldWhere", () => {
  it("is null unless sold", () => {
    for (const state of NOT_SOLD) expect(soldWhere(offer(state))).toBeNull();
  });

  it("reads the place from the sale reference, and the gallery from its own reference", () => {
    expect(soldWhere(offer("sold", shop))).toBe("lax_art");
    expect(soldWhere(offer("sold", lot))).toBe("bid_sale");
    expect(soldWhere(offer("sold", deal))).toBe("private_sale");
    expect(soldWhere(offer("sold", gallery))).toBe("gallery");
  });

  it("does not claim the gallery for a sold row that records no place", () => {
    expect(soldWhere(offer("sold", null))).toBe("unknown");
  });
});

describe("recordGallerySale", () => {
  const refFor: Record<string, OfferRef | null> = {
    held: null,
    withdrawn: null,
    lax_art: shop,
    bid_sale: lot,
    private_sale: deal,
  };

  it.each(NOT_SOLD)("moves %s to sold with the gallery sale as its reference", (state) => {
    expect(recordGallerySale(offer(state, refFor[state] ?? null), "z-1")).toEqual({
      ok: true,
      changed: true,
      from: state,
      state: "sold",
      ref: gallery,
    });
  });

  it("names the Zoho product that said so", () => {
    const result = recordGallerySale(offer("held"), "1023341000017963004");
    expect(result.ref).toEqual({ kind: "gallery_sale", id: "1023341000017963004" });
    expect(soldWhere({ state: "sold", ref: result.ref })).toBe("gallery");
  });

  it("is a no-op when already sold in the gallery (idempotent)", () => {
    expect(recordGallerySale(offer("sold", gallery), "z-1")).toEqual({
      ok: true,
      changed: false,
      state: "sold",
      ref: gallery,
    });
  });

  it("leaves a sold row that records no place as it is", () => {
    expect(recordGallerySale(offer("sold", null), "z-1")).toEqual({
      ok: true,
      changed: false,
      state: "sold",
      ref: null,
    });
  });

  it("leaves a sale made through LAX alone, keeping its reference", () => {
    expect(recordGallerySale(offer("sold", lot), "z-1")).toEqual({
      ok: true,
      changed: false,
      state: "sold",
      ref: lot,
    });
  });
});

describe("reopenSold", () => {
  it("returns a sold artwork to held with the reason recorded", () => {
    expect(reopenSold(offer("sold", gallery), "  Credit note issued 2 Nov  ")).toEqual({
      ok: true,
      from: "sold",
      state: "held",
      ref: null,
      reason: "Credit note issued 2 Nov",
      wasSoldWhere: "gallery",
    });
  });

  it("says where it had been sold, so a sale through LAX can be checked harder", () => {
    const result = reopenSold(offer("sold", shop), "Sold by mistake");
    expect(result.ok && result.wasSoldWhere).toBe("lax_art");
  });

  it("reopens a sold row that records no place, saying so", () => {
    const result = reopenSold(offer("sold", null), "Recorded by mistake");
    expect(result.ok && result.wasSoldWhere).toBe("unknown");
  });

  it("refuses anything that is not sold", () => {
    for (const state of NOT_SOLD) {
      expect(reopenSold(offer(state), "Mistake")).toEqual({ ok: false, refusal: "not_sold" });
    }
  });

  it("needs a reason, and not an endless one", () => {
    expect(reopenSold(offer("sold", gallery), "")).toEqual({
      ok: false,
      refusal: "reason_required",
    });
    expect(reopenSold(offer("sold", gallery), "   ")).toEqual({
      ok: false,
      refusal: "reason_required",
    });
    expect(reopenSold(offer("sold", gallery), "x".repeat(REOPEN_REASON_MAX_LENGTH)).ok).toBe(true);
    expect(reopenSold(offer("sold", gallery), "x".repeat(REOPEN_REASON_MAX_LENGTH + 1))).toEqual({
      ok: false,
      refusal: "reason_too_long",
    });
  });

  it("checks that it is sold before it looks at the reason", () => {
    expect(reopenSold(offer("held"), "")).toEqual({ ok: false, refusal: "not_sold" });
  });
});

describe("reconcileZohoStatus", () => {
  it("records a gallery sale when Zoho says Sold and the register does not", () => {
    for (const state of NOT_SOLD) {
      expect(reconcileZohoStatus(offer(state), "Sold")).toEqual({ action: "record_gallery_sale" });
    }
  });

  it("does nothing when the register already shows it sold, however it was sold", () => {
    expect(reconcileZohoStatus(offer("sold", gallery), "Sold")).toEqual({ action: "none" });
    expect(reconcileZohoStatus(offer("sold", lot), "Sold")).toEqual({ action: "none" });
  });

  it("asks for a decision when Zoho takes a gallery sale back", () => {
    for (const status of ["Available", "Reserved", "Withdrawn", "In Auction"]) {
      expect(reconcileZohoStatus(offer("sold", gallery), status)).toEqual({
        action: "needs_decision",
        kind: "zoho_took_sold_back",
      });
    }
  });

  it("keeps asking until a person decides, so repeating the notice changes nothing", () => {
    const first = reconcileZohoStatus(offer("sold", gallery), "Available");
    expect(reconcileZohoStatus(offer("sold", gallery), "Available")).toEqual(first);
  });

  it("does not treat a missing status as Zoho taking the sale back", () => {
    for (const status of [null, undefined, "", "  "]) {
      expect(reconcileZohoStatus(offer("sold", gallery), status)).toEqual({ action: "none" });
    }
  });

  it("does not ask for a decision about a sold row that records no place", () => {
    expect(reconcileZohoStatus(offer("sold", null), "Available")).toEqual({ action: "none" });
  });

  it("leaves a sale made through LAX to the ordinary conflict rule", () => {
    expect(reconcileZohoStatus(offer("sold", shop), "Available")).toEqual({ action: "none" });
  });

  it("changes nothing already offered for any other status", () => {
    for (const state of NOT_SOLD) {
      for (const status of ["Available", "Reserved", "In Auction", "Withdrawn", null]) {
        expect(reconcileZohoStatus(offer(state), status)).toEqual({ action: "none" });
      }
    }
  });

  it("returns to not-sold only through reopenSold: after it, Zoho's Available is quiet", () => {
    const reopened = reopenSold(offer("sold", gallery), "Credit note");
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reconcileZohoStatus(offer(reopened.state, reopened.ref), "Available")).toEqual({
        action: "none",
      });
    }
  });
});

describe("planGallerySale", () => {
  const original = (
    catalogueStatus: string | null,
    state: OfferState,
    ref: OfferRef | null = null,
  ) => ({
    kind: "original" as const,
    catalogueStatus,
    offer: offer(state, ref),
  });

  it("records the sale when Zoho says Sold on an artwork not offered", () => {
    expect(planGallerySale(original("Sold", "held"))).toEqual({
      action: "record",
      from: "held",
      laxArtListingId: null,
    });
    expect(planGallerySale(original(" sold ", "withdrawn"))).toEqual({
      action: "record",
      from: "withdrawn",
      laxArtListingId: null,
    });
  });

  it("records the sale and names the lax.art listing to take off sale", () => {
    expect(planGallerySale(original("Sold", "lax_art", shop))).toEqual({
      action: "record",
      from: "lax_art",
      laxArtListingId: "a",
    });
  });

  it("waits for staff while a Bid lot or a private sale holds the artwork", () => {
    expect(planGallerySale(original("Sold", "bid_sale", lot))).toEqual({
      action: "wait_for_staff",
      place: "bid_sale",
    });
    expect(planGallerySale(original("Sold", "private_sale", deal))).toEqual({
      action: "wait_for_staff",
      place: "private_sale",
    });
  });

  it("does nothing once sold, however it was sold, so a repeat is a no-op", () => {
    for (const ref of [gallery, shop, lot, deal, null]) {
      expect(planGallerySale(original("Sold", "sold", ref))).toEqual({ action: "none" });
    }
  });

  it("does nothing for any other Zoho status, or for a print", () => {
    for (const status of ["Available", "Reserved", "In Auction", "Withdrawn", null]) {
      expect(planGallerySale(original(status, "lax_art", shop))).toEqual({ action: "none" });
    }
    expect(
      planGallerySale({ kind: "print", catalogueStatus: "Sold", offer: offer("held") }),
    ).toEqual({ action: "none" });
  });
});

describe("reopenGallerySale", () => {
  it("reopens a gallery sale once Zoho no longer says Sold", () => {
    expect(
      reopenGallerySale({ catalogueStatus: "Available", offer: offer("sold", gallery) }, " Typo "),
    ).toEqual({
      ok: true,
      from: "sold",
      state: "held",
      ref: null,
      reason: "Typo",
      wasSoldWhere: "gallery",
    });
  });

  it("refuses while Zoho still says Sold, because Zoho wins", () => {
    expect(
      reopenGallerySale({ catalogueStatus: "Sold", offer: offer("sold", gallery) }, "Typo"),
    ).toEqual({ ok: false, refusal: "zoho_still_sold" });
  });

  it("refuses a sale made through LAX or one that records no place", () => {
    for (const ref of [shop, lot, deal, null]) {
      expect(
        reopenGallerySale({ catalogueStatus: "Available", offer: offer("sold", ref) }, "Typo"),
      ).toEqual({ ok: false, refusal: "not_a_gallery_sale" });
    }
  });

  it("keeps the reason checks and the not-sold refusal", () => {
    expect(
      reopenGallerySale({ catalogueStatus: "Available", offer: offer("held") }, "Typo"),
    ).toEqual({ ok: false, refusal: "not_sold" });
    expect(
      reopenGallerySale({ catalogueStatus: "Available", offer: offer("sold", gallery) }, " "),
    ).toEqual({ ok: false, refusal: "reason_required" });
  });

  it("has words for every refusal", () => {
    for (const message of Object.values(REOPEN_REFUSAL_MESSAGE)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
