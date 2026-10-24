import { describe, expect, it } from "vitest";
import {
  artworkListApiQuery,
  artworkListHref,
  artworkListPageHref,
  artworkPriceLabel,
  bulkVisibilityActions,
  editionSizeLabel,
  hasActiveArtworkFilters,
  parseArtworkListQuery,
  presentArtworkState,
  summariseBulkVisibility,
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
    expect(presentArtworkState("live")).toEqual({ label: "Live", tone: "success" });
    expect(presentArtworkState("sold_out")).toEqual({ label: "Sold out", tone: "warning" });
    expect(presentArtworkState("future_state").label).toBe("Future state");
  });

  it("reads edition size and price for staff", () => {
    expect(editionSizeLabel({ editionSize: 24 })).toBe("24");
    expect(editionSizeLabel({ editionSize: 0 })).toBe("Original");
    expect(
      artworkPriceLabel({ printPricePence: 45_000, editionSize: 24, saleState: "for_sale" }),
    ).toBe("£450.00");
    expect(
      artworkPriceLabel({ printPricePence: null, editionSize: 24, saleState: "for_sale" }),
    ).toBe("Not priced");
    expect(
      artworkPriceLabel({
        printPricePence: null,
        editionSize: 24,
        saleState: "price_on_application",
      }),
    ).toBe("On application");
    expect(
      artworkPriceLabel({ printPricePence: null, editionSize: 0, saleState: "for_sale" }),
    ).toBe("On enquiry");
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
