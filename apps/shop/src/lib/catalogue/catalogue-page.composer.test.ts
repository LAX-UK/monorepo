import { artworkSummary } from "@/test/artwork-summary.fixture";
import type { PublicArtworkFacetCounts, PublicArtworkSummary } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";
import { parseArtworkCatalogueParams } from "./artwork-catalogue-params";
import { composeCataloguePage } from "./catalogue-page.composer";
import type { CatalogueListQuery, CatalogueReader } from "./catalogue-page.port";
import { loadCatalogueResults } from "./catalogue-results";

const onSale = (slug: string) => artworkSummary({ slug });
const soldOut = (slug: string) =>
  artworkSummary({ slug, availability: { totalEditions: 24, state: "sold_out" } });

const facets = (available: number, sold: number): PublicArtworkFacetCounts => ({
  availability: { available, soldOut: sold },
  categories: [],
  artists: [{ slug: "flora-powers", name: "Flora Powers", count: available + sold }],
  priceBands: [],
  sizes: [],
  techniques: [{ value: "Screenprint", count: available + sold }],
});

/** A catalogue of editions, paged by offset like shop-api's cursor. */
function fakeReader(
  editions: PublicArtworkSummary[],
  overrides: Partial<CatalogueReader> = {},
): CatalogueReader {
  return {
    listEditions: vi.fn(async (query: CatalogueListQuery) => {
      const matching = editions.filter(
        (item) => !query.availability || item.availability.state === query.availability,
      );
      const offset = Number(query.cursor ?? 0);
      const items = matching.slice(offset, offset + query.limit);
      const next = offset + query.limit;
      return {
        items,
        totalCount: matching.length,
        ...(next < matching.length ? { nextCursor: String(next) } : {}),
      };
    }),
    countFacets: vi.fn(async () =>
      facets(
        editions.filter((e) => e.availability.state === "available").length,
        editions.filter((e) => e.availability.state === "sold_out").length,
      ),
    ),
    searchArtists: vi.fn(async () => ({ items: [] })),
    listCategories: vi.fn(async () => []),
    ...overrides,
  };
}

describe("loadCatalogueResults", () => {
  it("puts sold-out editions after those on sale, whatever the sort", async () => {
    const reader = fakeReader([soldOut("gone"), onSale("a"), onSale("b")]);
    const results = await loadCatalogueResults(reader, { sort: "priceAsc" });
    expect(results.items.map((item) => item.slug)).toEqual(["a", "b", "gone"]);
    expect(results.total).toBe(3);
  });

  it("reads past one request to fill the page, and keeps one availability when filtered", async () => {
    const many = Array.from({ length: 60 }, (_, i) => onSale(`e${i}`));
    const reader = fakeReader([...many, soldOut("gone")]);
    const results = await loadCatalogueResults(reader, {}, 72);
    expect(results.items).toHaveLength(61);
    expect(results.items.at(-1)?.slug).toBe("gone");
    const onlySold = await loadCatalogueResults(reader, { availability: "sold_out" });
    expect(onlySold.items.map((item) => item.slug)).toEqual(["gone"]);
  });
});

describe("composeCataloguePage", () => {
  it("shows the results with a count line and the rail", async () => {
    const reader = fakeReader([onSale("a"), onSale("b"), soldOut("c")]);
    const page = await composeCataloguePage(reader, parseArtworkCatalogueParams({}));
    expect(page.kind).toBe("catalogue");
    if (page.kind !== "catalogue") return;
    expect(page.countLine).toBe("3 editions by Flora Powers. Prices include VAT.");
    expect(page.liveMessage).toBe("3 editions");
    expect(page.rail.availability).toMatchObject({ checked: false });
    expect(page.results.loadMoreHref).toBeNull();
    expect(page.noMatch).toBeNull();
  });

  it("offers Load more while editions are left", async () => {
    const reader = fakeReader(Array.from({ length: 30 }, (_, i) => onSale(`e${i}`)));
    const page = await composeCataloguePage(reader, parseArtworkCatalogueParams({}));
    if (page.kind !== "catalogue") throw new Error(page.kind);
    expect(page.results.items).toHaveLength(24);
    expect(page.results.loadMoreHref).toBe("/artworks?shown=48");
  });

  it("is unavailable only when the list fails, not the counts", async () => {
    const failing = fakeReader([onSale("a")], {
      listEditions: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    expect(await composeCataloguePage(failing, parseArtworkCatalogueParams({}))).toEqual({
      kind: "unavailable",
    });
    const noCounts = fakeReader([onSale("a")], {
      countFacets: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    expect((await composeCataloguePage(noCounts, parseArtworkCatalogueParams({}))).kind).toBe(
      "catalogue",
    );
  });

  it("is empty, with no rail, when nothing is on sale anywhere", async () => {
    const page = await composeCataloguePage(fakeReader([]), parseArtworkCatalogueParams({}));
    expect(page).toEqual({ kind: "empty", countLine: "No editions on sale at the moment." });
  });

  it("offers to remove the last filter when filters give nothing", async () => {
    const editions = [onSale("a")];
    const reader = fakeReader(editions, {
      listEditions: vi.fn(async (query: CatalogueListQuery) =>
        query.maxPrice !== undefined
          ? { items: [], totalCount: 0 }
          : { items: editions, totalCount: 1 },
      ),
    });
    const page = await composeCataloguePage(
      reader,
      parseArtworkCatalogueParams({ availability: "available", price: "under-50" }),
    );
    if (page.kind !== "catalogue") throw new Error(page.kind);
    expect(page.noMatch?.remove).toEqual({
      label: "Under £50",
      href: "/artworks?availability=available",
    });
    expect(page.noMatch?.availableNow?.items.map((item) => item.slug)).toEqual(["a"]);
    expect(page.countLine).toBe("0 of 1 edition. Prices include VAT.");
  });

  it("answers a search with no results with what it may have meant", async () => {
    const editions = [onSale("a")];
    const reader = fakeReader(editions, {
      listEditions: vi.fn(async (query: CatalogueListQuery) =>
        query.q ? { items: [], totalCount: 0 } : { items: editions, totalCount: 1 },
      ),
    });
    const page = await composeCataloguePage(
      reader,
      parseArtworkCatalogueParams({ q: "screenprnt" }),
    );
    expect(page).toMatchObject({
      kind: "search-empty",
      query: "screenprnt",
      didYouMean: { term: "Screenprint", href: "/artworks?technique=Screenprint" },
    });
  });
});
