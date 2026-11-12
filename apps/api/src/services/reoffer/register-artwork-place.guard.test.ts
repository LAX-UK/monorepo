import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { RegisterArtworkPlaceGuard } from "./register-artwork-place.guard.js";

const LOT = "lot-1";

function entryOf(
  state: "held" | "withdrawn" | "bid_sale" | "shop_sale",
  ref: { kind: "bid_lot" | "shop_artwork"; id: string } | null,
  catalogueStatus: string | null,
): ArtworkRegisterEntry {
  return {
    id: "reg-1",
    zohoProductId: "z-1",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Untitled",
    artist: { zohoArtistId: null, name: "A", code: "GAC" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus,
    offer: { state, ref },
    zohoModifiedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    version: 1,
  } as ArtworkRegisterEntry;
}

function guardFor(entry: ArtworkRegisterEntry | null) {
  return new RegisterArtworkPlaceGuard(
    { findLink: async () => (entry ? { registerId: entry.id } : null) } as never,
    { findById: async () => entry } as never,
  );
}

describe("RegisterArtworkPlaceGuard (real offer lock)", () => {
  const here = { kind: "bid_lot", id: LOT } as const;

  it("refuses an artwork Sold in Zoho even while the register still points at this lot", async () => {
    const result = await guardFor(entryOf("bid_sale", here, "Sold")).check(LOT);
    expect(result.ok).toBe(false);
  });

  it("refuses a Sold artwork whatever the register state", async () => {
    for (const state of ["held", "withdrawn"] as const) {
      expect((await guardFor(entryOf(state, null, "Sold")).check(LOT)).ok).toBe(false);
    }
  });

  it("refuses an artwork Reserved in Zoho, even when still pointing at this lot", async () => {
    expect((await guardFor(entryOf("bid_sale", here, "Reserved")).check(LOT)).ok).toBe(false);
  });

  it("allows an artwork still on offer at this lot with no Zoho hold", async () => {
    expect((await guardFor(entryOf("bid_sale", here, "Available")).check(LOT)).ok).toBe(true);
    expect((await guardFor(entryOf("withdrawn", null, null)).check(LOT)).ok).toBe(true);
  });

  it("refuses an artwork offered at another place", async () => {
    const other = { kind: "shop_artwork", id: "art-9" } as const;
    expect((await guardFor(entryOf("shop_sale", other, null)).check(LOT)).ok).toBe(false);
  });

  it("does not govern a lot with no register record", async () => {
    expect((await guardFor(null).check(LOT)).ok).toBe(true);
  });
});
