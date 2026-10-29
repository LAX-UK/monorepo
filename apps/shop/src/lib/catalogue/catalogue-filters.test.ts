import type { PublicArtworkFacetCounts } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { parseArtworkCatalogueParams } from "./artwork-catalogue-params";
import { buildArtworkCatalogueActiveChips } from "./catalogue-active-chips";
import { catalogueCountLine } from "./catalogue-count-line";
import { editDistance, suggestCatalogueTerm } from "./catalogue-did-you-mean";
import { buildCatalogueFilterRail } from "./catalogue-filter-groups";
import { buildCatalogueQuickChips } from "./catalogue-quick-chips";
import { buildCatalogueSort } from "./catalogue-sort";

/** The test catalogue: Flora Powers' four editions, one sold out. */
const flora: PublicArtworkFacetCounts = {
  availability: { available: 3, soldOut: 1 },
  categories: [],
  artists: [{ slug: "flora-powers", name: "Flora Powers", count: 4 }],
  priceBands: [
    { key: "under-50", count: 1 },
    { key: "50-100", count: 2 },
    { key: "100-300", count: 1 },
    { key: "300-plus", count: 0 },
  ],
  sizes: [
    { key: "small", count: 2 },
    { key: "medium", count: 2 },
    { key: "large", count: 0 },
  ],
  techniques: [{ value: "Giclée print", count: 4 }],
};

const many: PublicArtworkFacetCounts = {
  ...flora,
  artists: [
    { slug: "ada", name: "Ada Reyes", count: 2 },
    { slug: "bo", name: "Bo Lind", count: 5 },
    { slug: "cy", name: "Cy Vane", count: 3 },
    { slug: "di", name: "Di Okoro", count: 1 },
  ],
};

const state = (params: Record<string, string> = {}) => parseArtworkCatalogueParams(params);

describe("catalogue filter rail", () => {
  it("leaves out groups with fewer than two options that have editions", () => {
    const rail = buildCatalogueFilterRail({ state: state(), facets: flora, artists: [] });
    expect(rail.groups.map((group) => group.key)).toEqual(["price", "size"]);
    const price = rail.groups.find((group) => group.key === "price");
    expect(price?.options.map((o) => [o.label, o.count])).toEqual([
      ["Under £50", 1],
      ["£50 to £100", 2],
      ["£100 to £300", 1],
    ]);
  });

  it("links each option to apply it, and an applied one to take it off", () => {
    const rail = buildCatalogueFilterRail({
      state: state({ size: "small" }),
      facets: flora,
      artists: [],
    });
    const size = rail.groups.find((group) => group.key === "size");
    expect(size?.options.find((o) => o.value === "small")).toMatchObject({
      active: true,
      href: "/artworks",
    });
    expect(size?.options.find((o) => o.value === "medium")?.href).toBe("/artworks?size=medium");
  });

  it("keeps a group with an applied option even when nothing else is left in it", () => {
    const rail = buildCatalogueFilterRail({
      state: state({ technique: "Giclée print" }),
      facets: flora,
      artists: [],
    });
    expect(rail.groups.map((group) => group.key)).toContain("technique");
  });

  it("shows the switch only when hiding sold-out editions changes the list", () => {
    expect(
      buildCatalogueFilterRail({ state: state(), facets: flora, artists: [] }).availability,
    ).toEqual({ checked: false, href: "/artworks?availability=available" });
    const allOnSale = { ...flora, availability: { available: 4, soldOut: 0 } };
    expect(
      buildCatalogueFilterRail({ state: state(), facets: allOnSale, artists: [] }).availability,
    ).toBeNull();
  });

  it("falls back to uncounted artists and prices when the counts did not load", () => {
    const rail = buildCatalogueFilterRail({
      state: state(),
      facets: null,
      artists: [
        { slug: "ada", name: "Ada Reyes" },
        { slug: "bo", name: "Bo Lind" },
      ],
    });
    expect(rail.groups.map((group) => group.key)).toEqual(["artist", "price"]);
    expect(rail.groups[0]?.options[0]).not.toHaveProperty("count");
  });
});

describe("catalogue quick chips", () => {
  it("offers the chips that narrow the list, with their counts", () => {
    const chips = buildCatalogueQuickChips(state(), flora);
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ["Available now", 3],
      ["Under £50", 1],
      ["£50 to £100", 2],
    ]);
  });

  it("gives the top two artists a chip, and keeps an applied chip to take it off", () => {
    const chips = buildCatalogueQuickChips(state({ artistSlug: "di" }), many);
    expect(chips.filter((c) => c.key.startsWith("artist-")).map((c) => c.label)).toEqual([
      "Bo Lind",
      "Cy Vane",
      "Di Okoro",
    ]);
    expect(chips.find((c) => c.label === "Di Okoro")).toMatchObject({
      active: true,
      href: "/artworks",
    });
  });

  it("has none without counts", () => {
    expect(buildCatalogueQuickChips(state(), null)).toEqual([]);
  });
});

describe("catalogue applied chips", () => {
  it("names each applied filter, with the link that takes it off", () => {
    const chips = buildArtworkCatalogueActiveChips(
      state({ q: "vessel", availability: "available", price: "under-50", artistSlug: "ada" }),
      { categories: [], artists: [{ slug: "ada", name: "Ada Reyes" }] },
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "“vessel”",
      "Available now",
      "Ada Reyes",
      "Under £50",
    ]);
    expect(chips.find((chip) => chip.key === "price")?.removeHref).toBe(
      "/artworks?q=vessel&artistSlug=ada&availability=available",
    );
  });

  it("names a free price range from an older link", () => {
    const [chip] = buildArtworkCatalogueActiveChips(state({ maxPrice: "150" }), {
      categories: [],
      artists: [],
    });
    expect(chip?.label).toBe("Up to £150");
  });
});

describe("catalogue count line", () => {
  const base = { catalogueTotal: 12, filtered: false };
  it("names one or two artists, and counts three or more", () => {
    expect(catalogueCountLine({ ...base, resultCount: 4, artistNames: ["Flora Powers"] })).toBe(
      "4 editions by Flora Powers. Prices include VAT.",
    );
    expect(
      catalogueCountLine({ ...base, resultCount: 6, artistNames: ["Ada Reyes", "Bo Lind"] }),
    ).toBe("6 editions by Ada Reyes and Bo Lind. Prices include VAT.");
    expect(
      catalogueCountLine({ ...base, resultCount: 12, artistNames: ["a", "b", "c", "d", "e"] }),
    ).toBe("12 editions by 5 artists. Prices include VAT.");
  });

  it("gives the share with filters, and says when nothing is on sale", () => {
    expect(catalogueCountLine({ ...base, filtered: true, resultCount: 0, artistNames: [] })).toBe(
      "0 of 12 editions. Prices include VAT.",
    );
    expect(
      catalogueCountLine({ catalogueTotal: 0, filtered: false, resultCount: 0, artistNames: [] }),
    ).toBe("No editions on sale at the moment.");
  });
});

describe("did you mean", () => {
  const entries = [{ term: "Screenprint" }, { term: "Giclée print" }, { term: "Flora Powers" }];

  it("counts typing slips", () => {
    expect(editDistance("screenprnt", "screenprint")).toBe(1);
    expect(editDistance("flora", "flora")).toBe(0);
  });

  it("finds the closest term, or a word in one", () => {
    expect(suggestCatalogueTerm("screenprnt", entries)?.term).toBe("Screenprint");
    expect(suggestCatalogueTerm("powrs", entries)?.term).toBe("Flora Powers");
  });

  it("suggests nothing when nothing is close, the search is short, or already a term", () => {
    expect(suggestCatalogueTerm("watercolour", entries)).toBeNull();
    expect(suggestCatalogueTerm("sc", entries)).toBeNull();
    expect(suggestCatalogueTerm("screenprint", entries)).toBeNull();
  });
});

describe("catalogue sort", () => {
  it("offers newest and the two price orders, each as a link", () => {
    const sort = buildCatalogueSort(state({ sort: "priceAsc", size: "small" }));
    expect(sort.current.label).toBe("Price low to high");
    expect(sort.options.map((option) => [option.label, option.href])).toEqual([
      ["Newest", "/artworks?size=small"],
      ["Price low to high", "/artworks?size=small&sort=priceAsc"],
      ["Price high to low", "/artworks?size=small&sort=priceDesc"],
    ]);
  });
});
