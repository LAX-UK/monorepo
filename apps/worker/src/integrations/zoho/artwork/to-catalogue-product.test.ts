import { describe, expect, it } from "vitest";
import { artistDirectory, artistRows, product, productRows } from "./fixtures/load-fixtures.js";
import { toCatalogueArtist, toCatalogueProduct } from "./to-catalogue-product.js";

describe("toCatalogueArtist", () => {
  it("reads the name and both codes", () => {
    expect(toCatalogueArtist(artistRows()[0] as never)).toEqual({
      id: "5000000000000077001",
      name: "Aidan Phelan",
      code1: "PH",
      code2: "GAC",
    });
  });

  it("drops a row with no name", () => {
    expect(toCatalogueArtist({ id: "1", Name: " " })).toBeNull();
  });
});

describe("toCatalogueProduct", () => {
  it("reads a complete Product, with the artist from the directory", () => {
    expect(product(1)).toEqual({
      id: "5000000000001000001",
      modifiedAt: new Date("2026-09-07T09:15:30.000Z"),
      title: "Harbour at dusk",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      artist: { id: "5000000000000077001", name: "Aidan Phelan", code1: "PH", code2: "GAC" },
      medium: "Oil on canvas",
      dimensions: "60 x 80 cm",
      status: "Available",
      year: 2024,
      unitPrice: 4200,
    });
  });

  it("turns empty strings and nulls into null and an unreadable year into null", () => {
    const sparse = product(2);
    expect(sparse.medium).toBeNull();
    expect(sparse.dimensions).toBeNull();
    expect(sparse.year).toBeNull();
    expect(sparse.unitPrice).toBe(0);
  });

  it("has no artist when the lookup is empty", () => {
    expect(product(6).artist).toBeNull();
  });

  it("falls back to the name on the lookup when the directory does not know the artist", () => {
    const row = productRows()[0] as Record<string, unknown>;
    const mapped = toCatalogueProduct(row, new Map());
    expect(mapped?.artist).toEqual({
      id: "5000000000000077001",
      name: "Aidan Phelan",
      code1: null,
      code2: null,
    });
  });

  it("accepts a lookup sent as a bare id", () => {
    const row = { ...(productRows()[0] as Record<string, unknown>), Artist: "5000000000000077004" };
    expect(toCatalogueProduct(row, artistDirectory())?.artist?.name).toBe("Banksy");
  });

  it("returns null without an id and null modifiedAt for an unreadable time", () => {
    expect(toCatalogueProduct({ Product_Name: "x" }, new Map())).toBeNull();
    expect(
      toCatalogueProduct({ id: "9", Product_Name: "x", Modified_Time: "yesterday" }, new Map())
        ?.modifiedAt,
    ).toBeNull();
  });
});
