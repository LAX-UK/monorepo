import { describe, expect, it } from "vitest";
import { mockArtworkDetail } from "../../test-support/mock-catalogue-read-models.js";
import type { ArtworkDetailReadModel } from "../read-models/catalogue.read-model.js";
import { createGetPublicArtworkHandler } from "./get-public-artwork.handler.js";

function handlerFor(artwork: ArtworkDetailReadModel | null) {
  return createGetPublicArtworkHandler({
    listPublicArtworks: async () => ({ items: [] }),
    getPublicArtworkBySlug: async () => artwork,
    listObjectTypeFacets: async () => [],
    countFacets: async () => ({
      availability: { available: 0, soldOut: 0 },
      categories: [],
      artists: [],
      priceBands: [],
      sizes: [],
      techniques: [],
    }),
  });
}

const original = mockArtworkDetail({
  salesChannel: "art",
  eligibleForEditionAllocation: false,
  rarity: "unique",
});

describe("get public artwork", () => {
  it("returns any public artwork when no storefront asks", async () => {
    expect(await handlerFor(original)("demo")).toBe(original);
    expect(await handlerFor(null)("demo")).toBeNull();
  });

  it("opens an original on lax.art and never through Shop", async () => {
    const get = handlerFor(original);
    expect(await get("demo", "art")).toBe(original);
    expect(await get("demo", "shop")).toBeNull();
  });

  it("does not open an editioned work on lax.art", async () => {
    const editioned = { ...original, rarity: "limited_edition" as const };
    expect(await handlerFor(editioned)("demo", "art")).toBeNull();
  });

  it("opens a Shop edition in Shop only", async () => {
    const edition = mockArtworkDetail();
    expect(await handlerFor(edition)("demo", "shop")).toBe(edition);
    expect(await handlerFor(edition)("demo", "art")).toBeNull();
  });
});
