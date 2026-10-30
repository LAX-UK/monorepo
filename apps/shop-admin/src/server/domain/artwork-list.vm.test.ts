import type { AdminArtworkListItem } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  artworkListApiQuery,
  artworkListHref,
  artworkListPageHref,
  artworkPanelHref,
  artworkPriceLabel,
  artworkSortParam,
  artworkSortState,
  bulkVisibilityActions,
  editionSizeLabel,
  hasActiveArtworkFilters,
  parseArtworkListQuery,
  presentArtworkState,
  summariseBulkVisibility,
  visibilityConfirmCopy,
} from "./artwork-list.vm";

const ARTIST = "22222222-2222-4222-8222-222222222222";
const A = "11111111-1111-4111-8111-111111111111";
const B = "11111111-1111-4111-8111-111111111112";

describe("artwork list URL state", () => {
  it("reads every known filter and drops the rest", () => {
    expect(
      parseArtworkListQuery({
        q: "  harbour ",
        state: "draft",
        artist: ARTIST,
        sale: "for_sale",
        channel: "art",
        cursor: "abc",
        extra: "x",
      }),
    ).toEqual({
      q: "harbour",
      state: "draft",
      artist: ARTIST,
      sale: "for_sale",
      channel: "art",
      cursor: "abc",
    });
  });

  it("ignores an unknown view, sale state, channel or a malformed artist id", () => {
    expect(
      parseArtworkListQuery({ state: "deleted", sale: "free", channel: "ebay", artist: "x" }),
    ).toEqual({});
  });

  it("caps a pasted search at the API's limit", () => {
    expect(parseArtworkListQuery({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  it("returns to the first page when a filter changes", () => {
    expect(artworkListHref({ q: "dusk", cursor: "next" }, { channel: "shop" })).toBe(
      "/artworks?q=dusk&channel=shop",
    );
    expect(artworkListHref({ q: "dusk", state: "live" }, { q: null })).toBe("/artworks?state=live");
    expect(artworkListPageHref({ state: "live" }, "c2")).toBe("/artworks?state=live&cursor=c2");
  });

  it("keeps the sort, page size and open artwork in the URL", () => {
    const query = parseArtworkListQuery({
      sort: "updated_asc",
      limit: "100",
      artwork: ARTIST,
      cursor: "c2",
    });
    expect(query).toEqual({ sort: "updated_asc", limit: "100", artwork: ARTIST, cursor: "c2" });
    expect(artworkSortState(query)).toEqual({ columnId: "updated", direction: "asc" });
    expect(artworkSortState({})).toEqual({ columnId: "updated", direction: "desc" });
    expect(artworkSortParam({ columnId: "updated", direction: "desc" })).toBeNull();
    expect(artworkPanelHref({ state: "live" }, ARTIST)).toBe(
      `/artworks?state=live&artwork=${ARTIST}`,
    );
    expect(artworkListHref(query, { q: "dusk" })).toBe(
      "/artworks?sort=updated_asc&limit=100&q=dusk",
    );
    expect(parseArtworkListQuery({ sort: "price_desc", limit: "7", artwork: "x" })).toEqual({});
  });

  it("counts search and filters, not the view, as filtering", () => {
    expect(hasActiveArtworkFilters({ state: "draft" })).toBe(false);
    expect(hasActiveArtworkFilters({ sale: "sold" })).toBe(true);
  });

  it("maps the URL to the API's parameter names", () => {
    expect(
      artworkListApiQuery({
        q: "dusk",
        artist: ARTIST,
        sale: "sold",
        channel: "art",
        state: "live",
      }),
    ).toEqual({
      q: "dusk",
      artistId: ARTIST,
      saleState: "sold",
      salesChannel: "art",
      state: "live",
    });
  });
});

describe("artwork list columns", () => {
  it("names each state and gives it a tone", () => {
    expect(presentArtworkState("live")).toEqual({ label: "Live", tone: "success", shape: "dot" });
    expect(presentArtworkState("sold_out")).toEqual({ label: "Sold out", tone: "warning" });
    expect(presentArtworkState("future_state").label).toBe("Future state");
  });

  it("reads the run and price for staff", () => {
    const run = (spec: NonNullable<AdminArtworkListItem["run"]>["spec"]) => ({
      spec,
      factsStatus: "needs_review" as const,
      factsLocked: false,
    });
    const standard = run({ type: "lax_standard" });
    expect(editionSizeLabel({ run: standard })).toBe("LAX standard 24");
    expect(
      editionSizeLabel({
        run: run({
          type: "custom_limited",
          size: 40,
          allocation: { buyer: 0, artist: 30, lax: 10 },
          linkedToOriginal: false,
        }),
      }),
    ).toBe("Custom 40");
    expect(
      editionSizeLabel({ run: run({ type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } }) }),
    ).toBe("Open");
    expect(editionSizeLabel({ run: null })).toBe("Original");
    expect(
      artworkPriceLabel({ printPricePence: 45_000, run: standard, saleState: "for_sale" }),
    ).toBe("£450.00");
    expect(artworkPriceLabel({ printPricePence: null, run: standard, saleState: "for_sale" })).toBe(
      "Not priced",
    );
    expect(
      artworkPriceLabel({
        printPricePence: null,
        run: standard,
        saleState: "price_on_application",
      }),
    ).toBe("On application");
    expect(artworkPriceLabel({ printPricePence: null, run: null, saleState: "for_sale" })).toBe(
      "On enquiry",
    );
  });

  it("keeps the edition facts filter in the URL and sends it to the API", () => {
    const query = parseArtworkListQuery({ facts: "needs_review" });
    expect(query.facts).toBe("needs_review");
    expect(hasActiveArtworkFilters(query)).toBe(true);
    expect(artworkListApiQuery(query)).toMatchObject({ facts: "needs_review" });
    expect(parseArtworkListQuery({ facts: "anything" }).facts).toBeUndefined();
  });
});

describe("bulk visibility", () => {
  it("offers only the actions that would change a selected row", () => {
    expect(bulkVisibilityActions([{ state: "draft" }])).toEqual(["publish", "archive"]);
    expect(bulkVisibilityActions([{ state: "live" }, { state: "sold_out" }])).toEqual([
      "unpublish",
      "archive",
    ]);
    expect(bulkVisibilityActions([{ state: "archived" }])).toEqual(["restore"]);
    expect(bulkVisibilityActions([{ state: "draft" }, { state: "archived" }])).toEqual([
      "publish",
      "archive",
      "restore",
    ]);
  });

  it("summarises a clean run in one line", () => {
    expect(
      summariseBulkVisibility(
        "publish",
        { results: [{ artworkId: A, outcome: "changed" }] },
        () => "Dusk",
      ),
    ).toEqual({ message: "Published 1 artwork", tone: "success", refusals: [] });
  });

  it("lists what was refused and why", () => {
    const titles: Record<string, string> = { [A]: "Dusk", [B]: "Dawn" };
    expect(
      summariseBulkVisibility(
        "publish",
        {
          results: [
            { artworkId: A, outcome: "refused", message: "Add an image before publishing" },
            { artworkId: B, outcome: "not_found" },
          ],
        },
        (id) => titles[id] ?? "?",
      ),
    ).toEqual({
      message: "No artworks were published. 2 could not be changed.",
      tone: "warning",
      refusals: ["Dusk: Add an image before publishing", "Dawn: it no longer exists"],
    });
  });
});

describe("visibilityConfirmCopy", () => {
  it("names the artwork, the storefront and the action for one row", () => {
    const copy = visibilityConfirmCopy("unpublish", [{ title: "Dusk", salesChannel: "art" }]);
    expect(copy.title).toBe("Unpublish “Dusk”?");
    expect(copy.description).toContain("leaves lax.art");
    expect(copy.confirmLabel).toBe("Unpublish artwork");
    expect(copy.tone).toBe("default");
  });

  it("counts a selection and names both storefronts when they differ", () => {
    const copy = visibilityConfirmCopy("archive", [
      { title: "Dusk", salesChannel: "art" },
      { title: "Dawn", salesChannel: "shop" },
    ]);
    expect(copy.title).toBe("Archive 2 artworks?");
    expect(copy.description).toContain("LAX Shop and lax.art");
    expect(copy.confirmLabel).toBe("Archive 2 artworks");
    expect(copy.tone).toBe("danger");
  });
});
