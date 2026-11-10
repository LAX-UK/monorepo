import { describe, expect, it } from "vitest";
import {
  EMPTY_ARTWORK_CATALOGUE_DRAFT,
  artworkDraftFromState,
  artworkDraftToPatch,
} from "./artwork-catalogue-draft";
import {
  artworkCatalogueFilterHref,
  parseArtworkCatalogueParams,
} from "./artwork-catalogue-params";

describe("artwork catalogue draft", () => {
  it("round-trips applied filters through the draft without touching search", () => {
    const state = parseArtworkCatalogueParams({
      q: "vessel",
      sort: "priceAsc",
      artistSlug: "ada,bo",
      objectType: "painting,print",
      categorySlug: "abstract",
      saleState: "for_sale",
      minPrice: "100",
      maxPrice: "500",
      cursor: "c2",
    });
    const href = artworkCatalogueFilterHref(
      state,
      artworkDraftToPatch(artworkDraftFromState(state)),
    );
    expect(href).toBe(
      "/artworks?q=vessel&categorySlug=abstract&artistSlug=ada,bo&saleState=for_sale&objectType=painting,print&minPrice=100&maxPrice=500&sort=priceAsc",
    );
  });

  it("clears every drawer facet on reset but keeps the search query", () => {
    const state = parseArtworkCatalogueParams({
      q: "vessel",
      artistSlug: "ada",
      objectType: "sculpture",
      saleState: "sold",
      categorySlug: "abstract",
      minPrice: "100",
      sort: "titleAsc",
    });
    expect(
      artworkCatalogueFilterHref(state, artworkDraftToPatch(EMPTY_ARTWORK_CATALOGUE_DRAFT)),
    ).toBe("/artworks?q=vessel");
  });

  it("drops a price that is not a number", () => {
    const patch = artworkDraftToPatch({
      ...EMPTY_ARTWORK_CATALOGUE_DRAFT,
      minPrice: "abc",
      maxPrice: " ",
    });
    expect(patch.minPrice).toBeNull();
    expect(patch.maxPrice).toBeNull();
  });

  it.each(["1,2,0,0", "12.345", "-5", "", "  ", "abc"])("drops the price %j", (text) => {
    const patch = artworkDraftToPatch({
      ...EMPTY_ARTWORK_CATALOGUE_DRAFT,
      minPrice: text,
    });
    expect(patch.minPrice).toBeNull();
  });

  it.each([
    ["£1,200", 1200],
    ["1,200.50", 1200],
    ["12.", 12],
  ])("reads the price %j as %d whole pounds", (text, pounds) => {
    expect(artworkDraftToPatch({ ...EMPTY_ARTWORK_CATALOGUE_DRAFT, maxPrice: text }).maxPrice).toBe(
      pounds,
    );
  });

  it("copies list facets so draft edits never mutate the applied state", () => {
    const state = parseArtworkCatalogueParams({ objectType: "painting" });
    const draft = artworkDraftFromState(state);
    draft.objectTypes.push("sculpture");
    expect(state.objectTypes).toEqual(["painting"]);
  });
});

describe("artworkDraftToPatch price filters", () => {
  const patchFor = (minPrice: string) =>
    artworkDraftToPatch({ ...EMPTY_ARTWORK_CATALOGUE_DRAFT, minPrice }).minPrice;

  it.each([
    ["", null],
    ["   ", null],
    ["250", 250],
    [" 250 ", 250],
    ["250.75", 250],
    ["abc", null],
    ["£250", 250],
    ["1,250", 1250],
    ["-5", null],
    ["12abc", null],
  ])("reads %j as %s", (text, expected) => {
    expect(patchFor(text)).toBe(expected);
  });
});
