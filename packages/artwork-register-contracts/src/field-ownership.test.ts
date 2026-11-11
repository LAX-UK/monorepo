import { describe, expect, it } from "vitest";
import { type ArtworkRegisterEntry, artworkRegisterEntrySchema } from "./entry.js";
import {
  FIELD_OWNERS,
  LAX_OWNED_FIELDS,
  REGISTER_FIELDS,
  ZOHO_OWNED_FIELDS,
  canAcceptZohoValue,
  ownerOf,
  reconcileZohoChange,
} from "./field-ownership.js";

const T0 = new Date("2026-11-01T10:00:00.000Z");
const T1 = new Date("2026-11-02T10:00:00.000Z");

function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: "0b3f7a52-2f1c-4a62-9d6c-5d7f6c8d1a11",
    zohoProductId: "5001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: ["img-1"],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: T0,
    createdAt: T0,
    updatedAt: T0,
    version: 3,
    ...overrides,
  };
}

describe("canAcceptZohoValue", () => {
  it("lets Zoho's stock code be taken over, and nothing about where a piece is offered", () => {
    expect(canAcceptZohoValue("stockCode")).toBe(true);
    for (const field of ["offerState", "kind", "sourceOriginalId"] as const) {
      expect(canAcceptZohoValue(field)).toBe(false);
    }
  });

  it("never takes over a Status conflict: Zoho's Status already stands", () => {
    expect(canAcceptZohoValue("catalogueStatus")).toBe(false);
  });
});

describe("field ownership table", () => {
  it("gives every field exactly one owner", () => {
    expect(new Set(REGISTER_FIELDS).size).toBe(REGISTER_FIELDS.length);
    for (const field of REGISTER_FIELDS) {
      expect(["zoho", "lax"]).toContain(ownerOf(field));
    }
    expect([...ZOHO_OWNED_FIELDS, ...LAX_OWNED_FIELDS].sort()).toEqual([...REGISTER_FIELDS].sort());
  });

  it("lets Zoho own the catalogue and LAX own selling", () => {
    expect(ZOHO_OWNED_FIELDS.sort()).toEqual([
      "artist",
      "catalogueStatus",
      "dimensions",
      "imageRefs",
      "medium",
      "title",
      "year",
    ]);
    expect(LAX_OWNED_FIELDS.sort()).toEqual([
      "kind",
      "offerState",
      "sourceOriginalId",
      "stockCode",
    ]);
    expect(FIELD_OWNERS.offerState).toBe("lax");
  });
});

describe("reconcileZohoChange", () => {
  it("applies changes to Zoho-owned fields", () => {
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: { title: "Harbour at dawn", year: 2025, imageRefs: ["img-1", "img-2"] },
    });
    expect(result).toEqual({
      apply: { title: "Harbour at dawn", year: 2025, imageRefs: ["img-1", "img-2"] },
      conflicts: [],
      stale: false,
    });
  });

  it("never applies a LAX-owned field; it records a conflict with both values", () => {
    const result = reconcileZohoChange(
      entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "l1" } } }),
      {
        zohoProductId: "5001",
        modifiedAt: T1,
        fields: { offerState: "held", stockCode: "LAX-ORI-PH-GAC-26-0002" },
      },
    );
    expect(result.apply).toEqual({});
    expect(result.conflicts).toEqual([
      {
        field: "stockCode",
        zohoValue: "LAX-ORI-PH-GAC-26-0002",
        laxValue: "LAX-ORI-PH-GAC-26-0001",
      },
      { field: "offerState", zohoValue: "held", laxValue: "bid_sale" },
    ]);
  });

  it("splits a mixed change into applied fields and conflicts", () => {
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: { medium: "Acrylic", kind: "print" },
    });
    expect(result.apply).toEqual({ medium: "Acrylic" });
    expect(result.conflicts).toEqual([{ field: "kind", zohoValue: "print", laxValue: "original" }]);
  });

  it("skips values that already match, including objects and lists", () => {
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: {
        title: "Harbour at dusk",
        artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
        imageRefs: ["img-1"],
        offerState: "held",
        year: 2024,
      },
    });
    expect(result).toEqual({ apply: {}, conflicts: [], stale: false });
  });

  it("applies a changed artist as a whole", () => {
    const artist = { zohoArtistId: "78", name: "Aidan Phelan", code: "PH" };
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: { artist },
    });
    expect(result.apply).toEqual({ artist });
  });

  it("applies a field cleared in Zoho", () => {
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: { medium: null },
    });
    expect(result.apply).toEqual({ medium: null });
  });

  it("ignores a change that is not newer than the last one applied", () => {
    for (const modifiedAt of [T0, new Date("2026-10-01T00:00:00.000Z")]) {
      const result = reconcileZohoChange(entry(), {
        zohoProductId: "5001",
        modifiedAt,
        fields: { title: "Other", offerState: "sold" },
      });
      expect(result).toEqual({ apply: {}, conflicts: [], stale: true });
    }
  });

  it("applies the first change to an entry that has none yet", () => {
    const result = reconcileZohoChange(entry({ zohoModifiedAt: null }), {
      zohoProductId: "5001",
      modifiedAt: T0,
      fields: { title: "New" },
    });
    expect(result.apply).toEqual({ title: "New" });
  });

  it("ignores fields the change does not mention", () => {
    const result = reconcileZohoChange(entry(), {
      zohoProductId: "5001",
      modifiedAt: T1,
      fields: {},
    });
    expect(result).toEqual({ apply: {}, conflicts: [], stale: false });
  });
});

describe("artworkRegisterEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(artworkRegisterEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it("rejects a malformed stock code and an unknown offer state", () => {
    expect(artworkRegisterEntrySchema.safeParse(entry({ stockCode: "nope" })).success).toBe(false);
    expect(
      artworkRegisterEntrySchema.safeParse(
        entry({ offer: { state: "listed" as never, ref: null } }),
      ).success,
    ).toBe(false);
  });
});
