import { describe, expect, it } from "vitest";
import {
  archiveCatalogBackHref,
  archiveLotLinkParams,
  artistDirectoryBackHref,
  artistProfileHref,
  catalogLotLinkParamsFromSearchParams,
  catalogViewCarryParams,
  lotCatalogBackHref,
  lotCatalogBackLabel,
  lotCatalogHref,
  saleCatalogBackHref,
  saleroomLotLinkParams,
} from "./catalog-links";

const lot = { id: "lot-1", title: "Blue Period" };

describe("lotCatalogHref", () => {
  it("returns path-only href without carry params", () => {
    expect(lotCatalogHref(lot)).toBe("/lot/blue-period/lot-1");
  });

  it("preserves view=list on lot links", () => {
    expect(lotCatalogHref(lot, { view: "list" })).toBe("/lot/blue-period/lot-1?view=list");
  });
});

describe("catalogViewCarryParams", () => {
  it("returns undefined for default grid view", () => {
    expect(catalogViewCarryParams("grid")).toBeUndefined();
  });

  it("returns view param for list mode", () => {
    expect(catalogViewCarryParams("list")).toEqual({ view: "list" });
  });
});

describe("saleroomLotLinkParams", () => {
  it("carries sale context with view and status", () => {
    expect(saleroomLotLinkParams("list", "live")).toEqual({
      from: "sale",
      view: "list",
      status: "live",
    });
  });

  it("omits grid view and null status", () => {
    expect(saleroomLotLinkParams("grid", null)).toEqual({ from: "sale" });
  });
});

describe("saleCatalogBackHref", () => {
  it("restores saleroom view and status from lot query", () => {
    expect(
      saleCatalogBackHref({ id: "sale-1", title: "Modern Art" }, { view: "list", status: "live" }),
    ).toBe("/sales/modern-art/sale-1?view=list&status=live");
  });
});

describe("artist profile link persistence", () => {
  it("carries directory filters on profile links", () => {
    expect(
      artistProfileHref(
        { id: "a-1", name: "Picasso" },
        {
          fromPath: "/artists/featured",
          searchParams: { q: "blue", sort: "popular" },
          layoutView: "list",
        },
      ),
    ).toBe("/artist/picasso/a-1?from=%2Fartists%2Ffeatured&q=blue&sort=popular&view=list");
  });

  it("builds directory back href from profile query", () => {
    expect(
      artistDirectoryBackHref({
        from: "/artists/featured",
        q: "blue",
        sort: "popular",
        view: "list",
      }),
    ).toBe("/artists/featured?q=blue&sort=popular&view=list");
  });
});

describe("view persistence matrix", () => {
  it("search → lot preserves list view", () => {
    const href = lotCatalogHref(lot, catalogViewCarryParams("list"));
    expect(href).toContain("view=list");
  });

  it("saleroom → lot preserves list view", () => {
    const href = lotCatalogHref(lot, saleroomLotLinkParams("list", null));
    expect(href).toContain("view=list");
  });

  it("home urgency → lot preserves list view", () => {
    const href = lotCatalogHref(lot, catalogViewCarryParams("list"));
    expect(href).toContain("view=list");
  });

  it("archive → lot carries archive context and list view", () => {
    const href = lotCatalogHref(lot, archiveLotLinkParams("list"));
    expect(href).toBe("/lot/blue-period/lot-1?from=archive&view=list");
  });

  it("intra-sale next lot preserves saleroom filters", () => {
    const params = catalogLotLinkParamsFromSearchParams({
      from: "sale",
      view: "list",
      status: "live",
    });
    expect(lotCatalogHref(lot, params)).toBe(
      "/lot/blue-period/lot-1?from=sale&view=list&status=live",
    );
  });

  it("lot back restores archive list view", () => {
    expect(archiveCatalogBackHref({ from: "archive", view: "list" })).toBe("/archive?view=list");
  });

  it("lot back label reflects origin", () => {
    expect(lotCatalogBackLabel({ from: "archive" })).toBe("Back to archive");
    expect(lotCatalogBackLabel({ from: "sale" }, { id: "s1", title: "Sale" })).toBe("Back to sale");
    expect(lotCatalogBackHref({ view: "list" })).toBe("/search?view=list");
  });
});
