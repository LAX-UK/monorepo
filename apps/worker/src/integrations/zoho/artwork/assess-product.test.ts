import { describe, expect, it } from "vitest";
import { assessProduct, zohoPriceText } from "./assess-product.js";
import { product } from "./fixtures/load-fixtures.js";

describe("assessProduct", () => {
  it("maps a complete Product to a new register entry and a change", () => {
    const a = assessProduct(product(1));
    expect(a.blockers).toEqual([]);
    expect(a.gaps).toEqual([]);
    expect(a.newEntry).toEqual({
      zohoProductId: "5000000000001000001",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      kind: "original",
      sourceOriginalId: null,
      title: "Harbour at dusk",
      artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
      medium: "Oil on canvas",
      dimensions: "60 x 80 cm",
      year: 2024,
      imageRefs: [],
      catalogueStatus: "Available",
      zohoPrice: expect.stringMatching(/^\d+\.\d{2}$/),
      zohoModifiedAt: new Date("2026-09-07T09:15:30.000Z"),
    });
    expect(a.change?.fields).toMatchObject({
      title: "Harbour at dusk",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      kind: "original",
      catalogueStatus: "Available",
    });
    // Zoho's Products carry no pictures; the register keeps whatever it has.
    expect(a.change?.fields).not.toHaveProperty("imageRefs");
  });

  it("uses the artist part of the stock code as the artist code", () => {
    const a = assessProduct(product(2));
    expect(a.newEntry?.artist.code).toBe("AD");
  });

  it("lists gaps that do not stop a Product coming in", () => {
    expect(assessProduct(product(2)).gaps).toEqual([
      "missing_medium",
      "missing_dimensions",
      "missing_price",
    ]);
    expect(assessProduct(product(2)).newEntry).not.toBeNull();
  });

  it("blocks creating a Product by a demo artist", () => {
    const a = assessProduct(product(3));
    expect(a.blockers).toContain("demo_artist");
    expect(a.newEntry).toBeNull();
  });

  it("blocks a Product with no stock code, and one in an old style", () => {
    expect(assessProduct(product(4)).blockers).toEqual(["missing_stock_code"]);
    expect(assessProduct(product(5)).blockers).toEqual(["invalid_stock_code"]);
    expect(assessProduct(product(4)).newEntry).toBeNull();
  });

  it("omits stock code and kind from the change when the code is not usable", () => {
    const fields = assessProduct(product(5)).change?.fields ?? {};
    expect(fields).not.toHaveProperty("stockCode");
    expect(fields).not.toHaveProperty("kind");
  });

  it("blocks a Product whose artist is missing from Zoho, and omits the artist from the change", () => {
    const a = assessProduct(product(6));
    expect(a.blockers).toEqual(["missing_artist"]);
    expect(a.change?.fields).not.toHaveProperty("artist");
  });

  it("reads a print from its stock code", () => {
    const a = assessProduct(product(7));
    expect(a.newEntry?.kind).toBe("print");
    expect(a.newEntry?.artist.code).toBe("BA");
  });

  it("flags an artist code in Zoho that disagrees with the stock code", () => {
    const base = product(1);
    const a = assessProduct({
      ...base,
      artist: base.artist && { ...base.artist, code1: "XX", code2: "YY" },
    });
    expect(a.gaps).toContain("artist_code_differs_from_stock_code");
    expect(a.newEntry?.artist.code).toBe("PH");
  });

  it("reads a print issued as PRT, and an older PRI one, as a print", () => {
    for (const stockCode of ["LAX-PRT-MP-GAC-26-0037", "LAX-PRI-MP-GAC-26-0037"]) {
      const a = assessProduct({ ...product(1), stockCode });
      expect(a.blockers).toEqual([]);
      expect(a.newEntry?.kind).toBe("print");
      expect(a.change?.fields.kind).toBe("print");
    }
  });

  it("warns, without blocking, when a code part is outside what LAX issues today", () => {
    const a = assessProduct({ ...product(1), stockCode: "LAX-ORI-M-GACGAC-26-0037" });
    expect(a.blockers).not.toContain("invalid_stock_code");
    expect(a.gaps).toContain("non_standard_code_parts");
    expect(assessProduct(product(1)).gaps).not.toContain("non_standard_code_parts");
  });

  it("cannot be created or changed without a readable modified time", () => {
    const a = assessProduct({ ...product(1), modifiedAt: null });
    expect(a.blockers).toContain("invalid_modified_time");
    expect(a.change).toBeNull();
    expect(a.newEntry).toBeNull();
  });
});

describe("zohoPriceText", () => {
  it("reads Zoho's Unit Price as pounds with pence", () => {
    expect(zohoPriceText(250)).toBe("250.00");
    expect(zohoPriceText(1234.5)).toBe("1234.50");
  });

  it("reads no price when Zoho has none worth showing", () => {
    expect(zohoPriceText(null)).toBeNull();
    expect(zohoPriceText(0)).toBeNull();
    expect(zohoPriceText(-5)).toBeNull();
    expect(zohoPriceText(Number.NaN)).toBeNull();
  });

  it("puts Zoho's price in the change, so the register follows it", () => {
    const a = assessProduct({ ...product(1), unitPrice: 4800 });
    expect(a.change?.fields.zohoPrice).toBe("4800.00");
    expect(a.newEntry?.zohoPrice).toBe("4800.00");
    expect(assessProduct({ ...product(1), unitPrice: null }).change?.fields.zohoPrice).toBeNull();
  });
});
