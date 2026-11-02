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
    ["£250", null],
    ["-5", -5],
  ])("reads %j as %s", (text, expected) => {
    expect(patchFor(text)).toBe(expected);
  });
});
