import { describe, expect, it } from "vitest";
import type { OfferState } from "./offer-state.js";
import {
  OVERRIDE_REASON_MAX_LENGTH,
  assessSoldWhileLive,
  checkOverrideReason,
  decideSoldWhileLive,
  soldWhileLiveCopy,
} from "./sold-while-live.js";

const entry = (
  catalogueStatus: string | null,
  state: OfferState,
  kind: "original" | "print" = "original",
) => ({
  kind,
  catalogueStatus,
  offer: { state, ref: null },
});

describe("assessSoldWhileLive", () => {
  it.each([
    ["Sold", "lax_art", "Sold", "lax_art"],
    ["Reserved", "lax_art", "Reserved", "lax_art"],
    ["sold", "bid_sale", "Sold", "bid_sale"],
    ["Sold", "private_sale", "Sold", "private_sale"],
  ] as const)("Zoho %s while %s is a situation", (zoho, state, status, place) => {
    expect(assessSoldWhileLive(entry(zoho, state))).toEqual({ status, place });
  });

  it("is a re-offer when the caller says the lot is offered to the next bidder", () => {
    expect(assessSoldWhileLive(entry("Sold", "bid_sale"), { reoffer: true })).toEqual({
      status: "Sold",
      place: "bid_reoffer",
    });
  });

  it("ignores Reserved for a private sale: that is the value LAX writes itself", () => {
    expect(assessSoldWhileLive(entry("Reserved", "private_sale"))).toBeNull();
    expect(assessSoldWhileLive(entry("reserved", "private_sale"))).toBeNull();
  });

  it("still counts Reserved on lax.art and in a bid sale", () => {
    expect(assessSoldWhileLive(entry("Reserved", "bid_sale"))).toEqual({
      status: "Reserved",
      place: "bid_sale",
    });
  });

  it.each(["held", "withdrawn", "sold"] as const)("is nothing when the offer is %s", (state) => {
    expect(assessSoldWhileLive(entry("Sold", state))).toBeNull();
  });

  it.each(["Available", "In Auction", null])("is nothing when Zoho says %s", (zoho) => {
    expect(assessSoldWhileLive(entry(zoho, "lax_art"))).toBeNull();
  });

  it("never governs a print", () => {
    expect(assessSoldWhileLive(entry("Sold", "lax_art", "print"))).toBeNull();
  });
});

describe("soldWhileLiveCopy", () => {
  const base = { title: "Blue Door", stockCode: "LAX-ORI-AB-001", markedOn: "3 November 2026" };

  it("says Sold on lax.art with the way out for lax.art", () => {
    expect(soldWhileLiveCopy({ ...base, status: "Sold", place: "lax_art" })).toEqual({
      tone: "danger",
      title: "Zoho says Sold, but this artwork is still for sale",
      body:
        "Blue Door (LAX-ORI-AB-001) was marked Sold in Zoho on 3 November 2026. " +
        "It is still on lax.art. New payments and acceptances are paused until you decide.",
      actions: [
        { kind: "unpublish_lax_art", label: "Unpublish from lax.art" },
        { kind: "open_in_zoho", label: "Open in Zoho" },
        { kind: "not_sold", label: "It is not sold" },
      ],
    });
  });

  it("says Reserved, and names the lot in a Bid sale", () => {
    const copy = soldWhileLiveCopy({
      ...base,
      status: "Reserved",
      place: "bid_sale",
      lotNumber: 12,
    });
    expect(copy.title).toBe("Zoho says Reserved, but this artwork is still for sale");
    expect(copy.body).toContain("was marked Reserved in Zoho");
    expect(copy.body).toContain("It is still in a LAX Bid sale, lot 12.");
    expect(copy.actions[0]).toEqual({ kind: "withdraw_lot", label: "Withdraw the lot" });
  });

  it("names the lot a re-offer is for and offers to withdraw the offer", () => {
    const copy = soldWhileLiveCopy({ ...base, status: "Sold", place: "bid_reoffer", lotNumber: 4 });
    expect(copy.body).toContain("It is still offered to the next bidder for LAX Bid lot 4.");
    expect(copy.actions[0]?.label).toBe("Withdraw the offer");
  });

  it("still reads when the lot number is not known", () => {
    expect(soldWhileLiveCopy({ ...base, status: "Sold", place: "bid_sale" }).body).toContain(
      "in a LAX Bid sale.",
    );
  });
});

describe("decideSoldWhileLive", () => {
  const sold = { status: "Sold", place: "lax_art" } as const;
  const reserved = { status: "Reserved", place: "lax_art" } as const;

  it("raises one item when there is a situation and no item", () => {
    expect(decideSoldWhileLive({ item: null, situation: sold, statusNow: "Sold" })).toEqual({
      action: "raise",
      situation: sold,
    });
  });

  it("does nothing when there is neither", () => {
    expect(decideSoldWhileLive({ item: null, situation: null, statusNow: "Available" })).toEqual({
      action: "none",
    });
  });

  it("does not raise a second item for the same artwork and status", () => {
    for (const state of ["open", "overridden"] as const) {
      expect(
        decideSoldWhileLive({
          item: { status: "Sold", state },
          situation: sold,
          statusNow: "Sold",
        }),
      ).toEqual({ action: "none" });
    }
  });

  it("resolves when Zoho goes back to Available", () => {
    expect(
      decideSoldWhileLive({
        item: { status: "Sold", state: "open" },
        situation: null,
        statusNow: "Available",
      }),
    ).toEqual({ action: "resolve", resolution: "zoho_status_changed" });
  });

  it("resolves as sold in LAX when Zoho says Sold and the artwork then sold on LAX", () => {
    expect(
      decideSoldWhileLive({
        item: { status: "Sold", state: "open" },
        situation: null,
        statusNow: "Sold",
        offerState: "sold",
      }),
    ).toEqual({ action: "resolve", resolution: "sold_in_lax" });
  });

  it("resolves as withdrawn when Zoho still says Sold but the listing is gone", () => {
    expect(
      decideSoldWhileLive({
        item: { status: "Sold", state: "open" },
        situation: null,
        statusNow: "Sold",
      }),
    ).toEqual({ action: "resolve", resolution: "withdrawn" });
  });

  it("replaces the item when Sold becomes Reserved", () => {
    expect(
      decideSoldWhileLive({
        item: { status: "Sold", state: "open" },
        situation: reserved,
        statusNow: "Reserved",
      }),
    ).toEqual({ action: "replace", situation: reserved });
  });
});

describe("checkOverrideReason", () => {
  it("requires a reason", () => {
    expect(checkOverrideReason("   ")).toEqual({ ok: false, refusal: "reason_required" });
  });

  it("keeps the trimmed reason", () => {
    expect(checkOverrideReason("  Zoho edited by mistake ")).toEqual({
      ok: true,
      reason: "Zoho edited by mistake",
    });
  });

  it("refuses a reason that is too long", () => {
    expect(checkOverrideReason("x".repeat(OVERRIDE_REASON_MAX_LENGTH + 1))).toEqual({
      ok: false,
      refusal: "reason_too_long",
    });
  });
});
