import { describe, expect, it } from "vitest";
import {
  merchandiseApiQuery,
  merchandiseListUrl,
  parseMerchandiseListSearch,
  toMerchandiseListRow,
} from "./merchandise-list.vm";

describe("parseMerchandiseListSearch", () => {
  it("reads the URL state", () => {
    expect(parseMerchandiseListSearch({ q: " tote ", status: "archived", cursor: "abc" })).toEqual({
      q: "tote",
      status: "archived",
      cursor: "abc",
    });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(parseMerchandiseListSearch({ status: "deleted", q: ["a", "b"] })).toEqual({
      q: "a",
      status: "all",
      cursor: undefined,
    });
  });

  it("caps the search text", () => {
    expect(parseMerchandiseListSearch({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("merchandiseListUrl", () => {
  it("leaves defaults out of the address", () => {
    expect(merchandiseListUrl({ q: "", status: "all", cursor: undefined })).toBe("/merchandise");
  });

  it("carries search, status and cursor", () => {
    expect(merchandiseListUrl({ q: "tote bag", status: "active", cursor: "c1" })).toBe(
      "/merchandise?q=tote+bag&status=active&cursor=c1",
    );
  });
});

describe("merchandiseApiQuery", () => {
  it("omits the all filter", () => {
    expect(merchandiseApiQuery({ q: "", status: "all", cursor: "c1" })).toEqual({});
    expect(merchandiseApiQuery({ q: "a", status: "archived", cursor: undefined })).toEqual({
      q: "a",
      status: "archived",
    });
  });
});

describe("toMerchandiseListRow", () => {
  const item = {
    productId: "p1",
    slug: "tote-bag",
    title: "Tote bag",
    status: "active" as const,
    variantCount: 2,
    fromPricePence: 1500,
    toPricePence: 2500,
    totalOnHand: 12,
  };

  it("shows a price range, the variant count and stock", () => {
    expect(toMerchandiseListRow(item)).toEqual({
      id: "p1",
      title: "Tote bag",
      slug: "tote-bag",
      status: "active",
      variants: "2 variants",
      price: "£15.00 – £25.00",
      stock: "12",
    });
  });

  it("shows one price when the range is a single value", () => {
    const row = toMerchandiseListRow({ ...item, variantCount: 1, toPricePence: 1500 });
    expect(row.price).toBe("£15.00");
    expect(row.variants).toBe("1 variant");
  });

  it("copes with a product that has no variants on sale", () => {
    const row = toMerchandiseListRow({
      ...item,
      variantCount: 0,
      fromPricePence: null,
      toPricePence: null,
      totalOnHand: 0,
    });
    expect(row.price).toBe("—");
    expect(row.variants).toBe("No variants on sale");
  });
});
