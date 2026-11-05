import { describe, expect, it } from "vitest";
import type { RegisterEventRecord } from "../ports/artwork-register-review.ports.js";
import { presentWhereItIs } from "./where-it-is.presenter.js";

const NOW = new Date("2026-11-05T10:00:00.000Z");
const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function moved(at: Date, from: string, to: string): RegisterEventRecord {
  return {
    id: `e-${at.getTime()}`,
    registerId: "r1",
    type: "offer_moved",
    actor: "staff:u1",
    payload: { from: { state: from, ref: null }, to: { state: to, ref: null } },
    createdAt: at,
  };
}

const held = { offer: { state: "held" as const, ref: null } };
const draft = {
  artworkId: "a1",
  slug: "s",
  published: false,
  createdAt: day(1).toISOString(),
};

describe("presentWhereItIs", () => {
  it("reads a held artwork as not offered", () => {
    expect(presentWhereItIs({ entry: held, events: [], laxArt: null, now: NOW })).toMatchObject({
      key: "not_offered",
    });
  });

  it("reads a held artwork with an unpublished listing as a draft on lax.art", () => {
    expect(presentWhereItIs({ entry: held, events: [], laxArt: draft, now: NOW })).toMatchObject({
      key: "draft_lax_art",
      chip: { label: "Draft on lax.art", marker: "hollow" },
    });
  });

  it("does not call a published listing a draft", () => {
    const live = { ...draft, published: true };
    expect(presentWhereItIs({ entry: held, events: [], laxArt: live, now: NOW }).key).toBe(
      "not_offered",
    );
  });

  it("says since when an artwork has been on lax.art", () => {
    const events = [moved(day(3), "held", "lax_art")];
    const place = presentWhereItIs({
      entry: { offer: { state: "lax_art", ref: { kind: "shop_artwork", id: "a1" } } },
      events,
      laxArt: { ...draft, published: true },
      now: NOW,
    });
    expect(place).toMatchObject({ key: "lax_art", since: day(3).toISOString() });
  });

  it("says where a withdrawn artwork was withdrawn from, and when", () => {
    const events = [moved(day(2), "bid_sale", "withdrawn")];
    const place = presentWhereItIs({
      entry: { offer: { state: "withdrawn", ref: null } },
      events,
      laxArt: null,
      now: NOW,
    });
    expect(place).toMatchObject({ key: "withdrawn", from: "LAX Bid", since: day(2).toISOString() });
  });

  it("reads a withdrawn artwork as not offered after 30 days", () => {
    const events = [moved(day(31), "lax_art", "withdrawn")];
    const place = presentWhereItIs({
      entry: { offer: { state: "withdrawn", ref: null } },
      events,
      laxArt: null,
      now: NOW,
    });
    expect(place.key).toBe("not_offered");
  });

  it("says where a sale happened", () => {
    const events = [moved(day(1), "lax_art", "sold")];
    const place = presentWhereItIs({
      entry: { offer: { state: "sold", ref: { kind: "shop_artwork", id: "a1" } } },
      events,
      laxArt: null,
      now: NOW,
    });
    expect(place).toMatchObject({ key: "sold", from: "On lax.art", since: day(1).toISOString() });
  });

  it("reads a held artwork with a draft lot in LAX Bid as a draft lot, and names the lot", () => {
    const bidDraft = { lotId: "lot-1", saleTitle: "Winter sale" };
    expect(
      presentWhereItIs({ entry: held, events: [], laxArt: draft, bidDraft, now: NOW }),
    ).toMatchObject({
      key: "draft_bid_lot",
      chip: { label: "Draft lot in LAX Bid", marker: "hollow" },
      bidLot: bidDraft,
    });
  });

  it("reads an artwork in a LAX Bid sale from the lot the register holds", () => {
    const entry = {
      offer: { state: "bid_sale" as const, ref: { kind: "bid_lot" as const, id: "lot-9" } },
    };
    expect(presentWhereItIs({ entry, events: [], laxArt: null, now: NOW })).toMatchObject({
      key: "bid_sale",
      chip: { label: "In a LAX Bid sale", marker: "filled" },
      bidLot: { lotId: "lot-9", saleTitle: null },
    });
  });

  it("has no lot where there is none", () => {
    expect(presentWhereItIs({ entry: held, events: [], laxArt: null, now: NOW }).bidLot).toBeNull();
  });
});
