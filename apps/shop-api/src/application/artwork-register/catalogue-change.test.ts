import type { ArtworkRegisterEntry, LotCatalogueFacts } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import {
  IN_SALE_NOTE,
  PUBLISHED_NOTE,
  bidLotCatalogueChange,
  bidLotContent,
  laxArtCatalogueChange,
  zohoImageUrls,
} from "./catalogue-change.js";
import type { ArtistForCode, LinkListingFacts } from "./zoho-link-differences.js";

const T0 = new Date("2026-11-03T09:00:00.000Z");

const entry = (patch: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry => ({
  id: "2f0b6d7e-0000-4000-8000-000000000001",
  zohoProductId: "5001",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  kind: "original",
  sourceOriginalId: null,
  title: "Tidal margin IV",
  artist: { zohoArtistId: "77", name: "Ada Rowe", code: "AR" },
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageRefs: ["a.jpg", "b.jpg"],
  catalogueStatus: "Available",
  offer: { state: "held", ref: null },
  zohoModifiedAt: T0,
  createdAt: T0,
  updatedAt: T0,
  version: 1,
  ...patch,
});

const facts = (patch: Partial<LinkListingFacts> = {}): LinkListingFacts => ({
  title: "Tidal margin IV",
  artistId: "artist-1",
  artistName: "Ada Rowe",
  artistCode: "AR",
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageKeys: ["a.jpg", "b.jpg"],
  ...patch,
});

const ada: ArtistForCode = { artistId: "artist-1", displayName: "Ada Rowe", archived: false };
const copy = (published: boolean, patch: Partial<LinkListingFacts> = {}) => ({
  published,
  facts: facts(patch),
  artistForCode: ada,
});

describe("laxArtCatalogueChange", () => {
  it("has nothing to say while the listing matches Zoho", () => {
    expect(laxArtCatalogueChange(copy(false), entry())).toBeNull();
    expect(laxArtCatalogueChange(copy(true), entry())).toBeNull();
  });

  it("shows each difference as lax.art's value beside Zoho's", () => {
    const result = laxArtCatalogueChange(copy(false, { title: "Old title", year: 2020 }), entry());
    const changed = result?.change.comparison.filter((row) => row.changes);
    expect(changed).toEqual([
      {
        field: "title",
        label: "Title",
        laxArtValue: "Old title",
        zohoValue: "Tidal margin IV",
        changes: true,
      },
      { field: "year", label: "Year", laxArtValue: "2020", zohoValue: "2024", changes: true },
    ]);
  });

  it("lets a draft take Zoho's values in one click", () => {
    const { change } = laxArtCatalogueChange(copy(false, { medium: "Acrylic" }), entry()) ?? {};
    expect(change).toMatchObject({ copy: "lax_art", state: "draft", canUpdate: true, note: null });
  });

  it("shows a published listing but never offers to change it", () => {
    const { change } = laxArtCatalogueChange(copy(true, { medium: "Acrylic" }), entry()) ?? {};
    expect(change).toMatchObject({
      state: "published",
      canUpdate: false,
      note: PUBLISHED_NOTE,
    });
  });

  it("will not update a draft whose artist has to be fixed first, and says why", () => {
    const { change } =
      laxArtCatalogueChange(
        {
          published: false,
          facts: facts({ artistCode: null, artistName: "Someone Else" }),
          artistForCode: null,
        },
        entry({ title: "New title" }),
      ) ?? {};
    expect(change).toMatchObject({ state: "draft", canUpdate: false });
    expect(change?.note).toContain("No lax.art artist has Zoho artist code AR");
  });
});

describe("bid lot changes", () => {
  const lot = (patch: Partial<LotCatalogueFacts> = {}): LotCatalogueFacts => ({
    lotId: "3f0b6d7e-0000-4000-8000-000000000009",
    status: "draft",
    saleStatus: "draft",
    title: "Tidal margin IV",
    medium: "Oil on linen",
    dimensions: "90 × 120 cm",
    imageUrls: ["https://img/a.jpg", "https://img/b.jpg"],
    ...patch,
  });
  const urls = ["https://img/a.jpg", "https://img/b.jpg"];

  it("has nothing to say while the lot matches Zoho", () => {
    expect(bidLotCatalogueChange(lot(), entry(), urls)).toBeNull();
  });

  it("treats blank and missing as the same, and does not compare what staff own on a lot", () => {
    expect(
      bidLotCatalogueChange(
        lot({ medium: "  ", dimensions: "" }),
        entry({
          medium: null,
          dimensions: null,
          year: 1999,
          artist: { zohoArtistId: null, name: "Other", code: "OT" },
        }),
        urls,
      ),
    ).toBeNull();
  });

  it("flags a draft whose title, size or pictures differ, and lets it update", () => {
    const change = bidLotCatalogueChange(
      lot({ title: "Old", dimensions: "10 cm", imageUrls: ["https://img/a.jpg"] }),
      entry(),
      urls,
    );
    expect(change).toMatchObject({ copy: "bid_lot", state: "draft", canUpdate: true, note: null });
    expect(change?.comparison.filter((row) => row.changes).map((row) => row.field)).toEqual([
      "title",
      "size",
      "images",
    ]);
  });

  it.each([
    ["scheduled", { status: "scheduled" as const }],
    ["live", { status: "active" as const, saleStatus: "active" }],
    ["in a sale that has started", { saleStatus: "active" }],
    ["in an upcoming sale", { saleStatus: "scheduled" }],
  ])("shows a %s lot's difference but never offers to change it", (_name, patch) => {
    const change = bidLotCatalogueChange(lot({ title: "Old", ...patch }), entry(), urls);
    expect(change).toMatchObject({ state: "in_sale", canUpdate: false, note: IN_SALE_NOTE });
  });

  it("gives a draft lot Zoho's catalogue facts, with blank read as none", () => {
    expect(bidLotContent(entry({ medium: " ", dimensions: "10 cm" }), urls)).toEqual({
      title: "Tidal margin IV",
      medium: null,
      dimensions: "10 cm",
      imageUrls: urls,
    });
  });

  it("turns Zoho's pictures into distinct public addresses, capped", () => {
    const refs = Array.from({ length: 30 }, (_, i) => `k${i % 25}.jpg`);
    const result = zohoImageUrls(entry({ imageRefs: refs }), (key) =>
      key ? `https://img/${key}` : null,
    );
    expect(result).toHaveLength(20);
    expect(new Set(result).size).toBe(20);
  });
});
