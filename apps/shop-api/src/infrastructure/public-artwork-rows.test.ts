import { describe, expect, it } from "vitest";
import { type SelectedArtworkRow, toArtworkCatalogueRow } from "./public-artwork-rows.js";

const row: SelectedArtworkRow = {
  artworkId: "a1",
  slug: "whispers-of-mortality",
  title: "Whispers of Mortality",
  description: null,
  primaryImageUrl: "shop/artwork/thelax-whispers.jpg",
  saleState: "price_on_application",
  dimensions: null,
  heightCm: null,
  widthCm: null,
  depthCm: null,
  medium: null,
  yearCreated: null,
  objectType: null,
  rarity: null,
  hasCertificate: false,
  provenance: null,
  exhibitionHistory: null,
  seoTitle: null,
  seoDescription: null,
  updatedAt: new Date("2026-10-30T00:00:00Z"),
  salesChannel: "art",
  artistName: "Artist",
  artistSlug: "artist",
  eligibleForEditionAllocation: false,
  printPricePence: null,
  createdAt: new Date("2026-10-30T00:00:00Z"),
} as SelectedArtworkRow;

describe("toArtworkCatalogueRow", () => {
  const resolve = (value: string | null | undefined) =>
    value ? (value.startsWith("/") ? value : `https://media.example/${value}`) : null;

  it("resolves a stored media key to a public URL, so list cards show the image", () => {
    expect(toArtworkCatalogueRow(row, new Map(), resolve).primaryImageUrl).toBe(
      "https://media.example/shop/artwork/thelax-whispers.jpg",
    );
  });

  it("keeps root-relative seed paths as they are", () => {
    const seeded = { ...row, primaryImageUrl: "/art/seed/original-3.webp" };
    expect(toArtworkCatalogueRow(seeded, new Map(), resolve).primaryImageUrl).toBe(
      "/art/seed/original-3.webp",
    );
  });
});
