import { describe, expect, it } from "vitest";
import {
  merchandiseList,
  priceRangeLabel,
  toMerchandiseListRow,
  variantsLabel,
} from "./merchandise-list.vm";

describe("merchandiseList", () => {
  it("reads the view, search and open product from the URL", () => {
    expect(
      merchandiseList.parse({ q: " tote ", view: "archived", cursor: "abc", product: "p1" }),
    ).toEqual({ view: "archived", q: "tote", cursor: "abc", filters: {}, open: "p1" });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(merchandiseList.parse({ view: "deleted", q: ["a", "b"] })).toEqual({
      view: "all",
      q: "a",
      filters: {},
    });
  });

  it("caps the search text and never carries a sort", () => {
    expect(merchandiseList.parse({ q: "x".repeat(300) }).q).toHaveLength(100);
    expect(merchandiseList.parse({ sort: "created_asc" }).sort).toBeUndefined();
  });

  it("asks the API for a status only for a status view", () => {
    expect(merchandiseList.apiQuery(merchandiseList.parse({}))).toEqual({});
    expect(merchandiseList.apiQuery(merchandiseList.parse({ view: "active", q: "tote" }))).toEqual({
      status: "active",
      q: "tote",
    });
  });

  it("labels the views with their counts", () => {
    const views = merchandiseList.views(merchandiseList.parse({}), { active: 4, archived: 1 });
    expect(views.map((view) => [view.label, view.count])).toEqual([
      ["All", 5],
      ["On sale", 4],
      ["Archived", 1],
    ]);
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

  it("carries the figures the list formats", () => {
    expect(toMerchandiseListRow(item)).toEqual({
      id: "p1",
      title: "Tote bag",
      slug: "tote-bag",
      status: "active",
      variantCount: 2,
      fromPricePence: 1500,
      toPricePence: 2500,
      totalOnHand: 12,
    });
  });
});

describe("labels", () => {
  it("shows a price range, or one price when the range is a single value", () => {
    expect(priceRangeLabel(1500, 2500)).toBe("£15.00 – £25.00");
    expect(priceRangeLabel(1500, 1500)).toBe("£15.00");
    expect(priceRangeLabel(null, null)).toBeNull();
  });

  it("counts variants on sale", () => {
    expect(variantsLabel(2)).toBe("2 variants");
    expect(variantsLabel(1)).toBe("1 variant");
    expect(variantsLabel(0)).toBe("No variants on sale");
  });
});
