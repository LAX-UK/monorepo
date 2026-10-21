import { artistSummary, artworkSummary, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  SEARCH_PAGE_SIZE,
  type SearchResultsVm,
  composeSearchPage,
} from "./search-page.composer.js";

const exhibition = {
  slug: "gold-rooms",
  kind: "exhibition" as const,
  title: "Gold Rooms",
  summary: null,
  startsOn: "2026-01-10",
  endsOn: "2026-02-20",
  coverUrl: null,
  featured: false,
};

const story = {
  slug: "on-gold",
  kind: "article" as const,
  title: "On gold",
  standfirst: "Gilding in practice.",
  coverUrl: null,
  featured: false,
};

function results(vm: Awaited<ReturnType<typeof composeSearchPage>>): SearchResultsVm {
  if (vm.status !== "results") throw new Error(`expected results, got ${vm.status}`);
  return vm;
}

function servicesWithCounts(available: number, sold: number) {
  const services = fakeArtServices();
  services.catalogue.listArtworks.mockImplementation(async (query) => ({
    items: query.limit === 1 ? [] : [artworkSummary()],
    totalCount: query.saleState === "sold" ? sold : available,
  }));
  return services;
}

describe("composeSearchPage", () => {
  it("stays idle without a query and offers a browse card cover", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworkObjectTypes.mockResolvedValue({
      items: [
        { objectType: "print", artworkCount: 2, coverImageUrl: null },
        { objectType: "painting", artworkCount: 4, coverImageUrl: "/cover.webp" },
      ],
    });

    const vm = await composeSearchPage(services, { q: "   " });

    expect(vm).toEqual({ status: "idle", query: "", browseImageUrl: "/cover.webp" });
    expect(services.catalogue.listArtworks).not.toHaveBeenCalled();
  });

  it("loads one page for the active tab and a count-only read for the other", async () => {
    const services = servicesWithCounts(3, 45);

    const vm = results(await composeSearchPage(services, { q: " coin ", sort: "titleAsc" }));

    expect(services.catalogue.listArtworks).toHaveBeenCalledTimes(2);
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      q: "coin",
      saleState: "available",
      limit: SEARCH_PAGE_SIZE,
      sort: "titleAsc",
    });
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      q: "coin",
      saleState: "sold",
      limit: 1,
    });
    expect(vm.activeTab).toBe("available");
    expect(vm.panel).toMatchObject({ kind: "artworks", count: 3, nextPageHref: null });
    expect(vm.tabs.map((tab) => tab.label)).toEqual(["Available (3)", "Sold (45)"]);
    expect(vm.favoriteAuth.loginHref).toBe(
      "/login?returnTo=%2Fsearch%3Fq%3Dcoin%26sort%3DtitleAsc",
    );
  });

  it("pages the sold tab and applies filters to both artwork reads", async () => {
    const services = servicesWithCounts(1, 2);

    const vm = results(
      await composeSearchPage(services, {
        q: "coin",
        tab: "sold",
        objectType: "painting",
        minPrice: "100",
        availability: "for_sale",
      }),
    );

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      q: "coin",
      saleState: "sold",
      objectTypes: ["painting"],
      minPrice: 10_000,
      limit: SEARCH_PAGE_SIZE,
      sort: "newest",
    });
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      q: "coin",
      saleState: "available",
      objectTypes: ["painting"],
      minPrice: 10_000,
      limit: 1,
    });
    // Availability only narrows the Available tab, so it is dropped on Sold.
    expect(vm.activeFilterCount).toBe(2);
    expect(vm.activeTab).toBe("sold");
  });

  it("links the next page with the cursor from the API", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({
      items: [artworkSummary()],
      nextCursor: "abc",
      totalCount: 30,
    });

    const vm = results(await composeSearchPage(services, { q: "coin" }));

    expect(vm.panel).toMatchObject({ nextPageHref: "/search?q=coin&cursor=abc" });
  });

  it("shows exhibitions and articles tabs with counts when editorial is on", async () => {
    const services = servicesWithCounts(1, 0);
    services.editorialSearch.searchExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: [exhibition] },
    });
    services.editorialSearch.searchStories.mockResolvedValue({
      status: "ok",
      data: { items: [story, { ...story, slug: "gold-leaf" }] },
    });

    const vm = results(await composeSearchPage(services, { q: "gold", tab: "articles" }));

    expect(services.editorialSearch.searchExhibitions).toHaveBeenCalledWith("gold");
    expect(vm.tabs.map((tab) => tab.label)).toEqual([
      "Available (1)",
      "Sold (0)",
      "Exhibitions (1)",
      "Articles (2)",
    ]);
    expect(vm.panel).toMatchObject({ kind: "editorial", count: 2 });
    expect(vm.panel.kind === "editorial" && vm.panel.cards[0]?.href).toBe("/stories/on-gold");
    // Editorial tabs never page artworks: both artwork reads are count-only.
    expect(services.catalogue.listArtworks).toHaveBeenCalledWith(
      expect.objectContaining({ saleState: "available", limit: 1 }),
    );
  });

  it("degrades only the editorial tabs when editorial search fails", async () => {
    const services = servicesWithCounts(2, 0);
    services.editorialSearch.searchExhibitions.mockResolvedValue({ status: "error" });
    services.editorialSearch.searchStories.mockRejectedValue(new Error("down"));

    const listVm = results(await composeSearchPage(services, { q: "gold" }));
    expect(listVm.panel.kind).toBe("artworks");
    expect(listVm.tabs.map((tab) => tab.label)).toEqual([
      "Available (2)",
      "Sold (0)",
      "Exhibitions",
      "Articles",
    ]);

    const tabVm = results(await composeSearchPage(services, { q: "gold", tab: "exhibitions" }));
    expect(tabVm.panel).toEqual({ kind: "unavailable" });
  });

  it("hides editorial tabs when editorial is disabled and falls back to Available", async () => {
    const services = servicesWithCounts(1, 1);
    const vm = results(await composeSearchPage(services, { q: "gold", tab: "articles" }));
    expect(vm.activeTab).toBe("available");
    expect(vm.tabs.map((tab) => tab.id)).toEqual(["available", "sold"]);
  });

  it("links an artist whose name matches the query exactly", async () => {
    const services = servicesWithCounts(1, 0);
    services.catalogue.listArtists.mockResolvedValue({
      items: [
        artistSummary({ slug: "flora-powers-studio", name: "Flora Powers Studio" }),
        artistSummary(),
      ],
    });

    const vm = results(await composeSearchPage(services, { q: "flora  POWERS" }));

    expect(services.catalogue.listArtists).toHaveBeenCalledWith({ q: "flora  POWERS", limit: 6 });
    expect(vm.artistLink).toEqual({ name: "Flora Powers", href: "/artists/flora-powers" });
  });

  it("reports no results when every tab is empty and nothing narrows it", async () => {
    const vm = results(await composeSearchPage(servicesWithCounts(0, 0), { q: "zzzz" }));
    expect(vm.noResults).toBe(true);
    expect(vm.tabs.map((tab) => tab.label)).toEqual(["Available (0)", "Sold (0)"]);
  });

  it("is not a no-results page when filters emptied the tab", async () => {
    const vm = results(
      await composeSearchPage(servicesWithCounts(0, 0), { q: "zzzz", objectType: "print" }),
    );
    expect(vm.noResults).toBe(false);
  });

  it("degrades a failed artwork read to an unavailable panel without a count", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockImplementation(async (query) => {
      if (query.saleState === "available") throw new Error("down");
      return { items: [], totalCount: 4 };
    });
    services.editorialSearch.searchStories.mockResolvedValue({ status: "ok", data: { items: [] } });

    const vm = results(await composeSearchPage(services, { q: "x" }));

    expect(vm.panel).toEqual({ kind: "unavailable" });
    expect(vm.tabs[0]?.label).toBe("Available");
    expect(vm.noResults).toBe(false);
  });

  it("reports unavailable only when artworks and editorial all fail", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));
    expect((await composeSearchPage(services, { q: "x" })).status).toBe("unavailable");
  });
});
