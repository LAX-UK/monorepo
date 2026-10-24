import { describe, expect, it } from "vitest";
import { artistListApiQuery, artistListHref, parseArtistListQuery } from "./artist-list.vm";
import {
  artworkPermissions,
  artworkVisibilityActions,
  editionAllocationSummary,
  editionRunFacts,
  publishBlockerMessages,
} from "./artwork-editor.vm";

const run = {
  size: 24,
  committed: 5,
  byStatus: {
    not_authorised: 10,
    authorised: 9,
    reserved: 2,
    held: 1,
    sold: 2,
    withdrawn: 0,
  },
  byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
};

describe("artwork editor view-model", () => {
  it("shows staff the run's sold, committed, on-sale and not-yet counts", () => {
    expect(editionRunFacts(run)).toEqual([
      { id: "sold", label: "Sold", value: 2 },
      { id: "committed", label: "Reserved or held", value: 3, hint: "2 in a checkout" },
      { id: "for-sale", label: "On sale", value: 9 },
      { id: "not-authorised", label: "Not yet on sale", value: 10 },
    ]);
  });

  it("summarises the allocation of the run", () => {
    expect(editionAllocationSummary(run)).toBe("10 buyer entitlement · 10 artist · 4 LAX");
  });

  it("explains each publish blocker as a sentence", () => {
    expect(publishBlockerMessages({ publishBlockers: ["no_image", "no_edition_price"] })).toEqual([
      "Add an image before publishing.",
      "Set the edition price before publishing.",
    ]);
  });

  it("offers publish only once nothing blocks it", () => {
    expect(artworkVisibilityActions({ state: "draft", publishBlockers: [] })).toEqual({
      primary: "publish",
      more: ["archive"],
    });
    expect(artworkVisibilityActions({ state: "draft", publishBlockers: ["no_image"] })).toEqual({
      primary: null,
      more: ["archive"],
    });
    expect(artworkVisibilityActions({ state: "sold_out", publishBlockers: [] }).primary).toBe(
      "unpublish",
    );
    expect(artworkVisibilityActions({ state: "archived", publishBlockers: [] })).toEqual({
      primary: "restore",
      more: [],
    });
  });

  it("reads the two capabilities the editor needs from the session", () => {
    expect(artworkPermissions(["catalogue.write", "artwork_price.write"])).toEqual({
      write: true,
      setPrice: true,
    });
    expect(artworkPermissions(["catalogue.write"])).toEqual({ write: true, setPrice: false });
    expect(artworkPermissions(["order.read"])).toEqual({ write: false, setPrice: false });
  });
});

describe("artist list URL state", () => {
  it("defaults to active artists and keeps other views in the URL", () => {
    expect(parseArtistListQuery({})).toEqual({});
    expect(artistListApiQuery({})).toEqual({ status: "active" });
    expect(artistListApiQuery({ view: "archived", q: "ada" })).toEqual({
      status: "archived",
      q: "ada",
    });
    expect(artistListApiQuery({ view: "all" })).toEqual({});
  });

  it("drops an unknown view and returns to page one on change", () => {
    expect(parseArtistListQuery({ view: "deleted", q: " ada " })).toEqual({ q: "ada" });
    expect(artistListHref({ q: "ada", cursor: "c" }, { view: "archived" })).toBe(
      "/artists?q=ada&view=archived",
    );
    expect(artistListHref({ view: "archived" }, { view: "active" })).toBe("/artists");
  });
});
