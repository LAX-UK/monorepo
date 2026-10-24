import { describe, expect, it } from "vitest";
import {
  artworkCatalogueState,
  artworkPublishBlockers,
  assertArtistArchivable,
  assertArtworkPublishable,
  assertEditionPrice,
  assertEditionRunUnchanged,
  assertLivePriceKept,
  isArtworkSoldOut,
  summariseEditionRun,
} from "./artwork-catalogue.js";
import { planEditionsForArtwork } from "./edition-allocation.js";
import { roleHasCapability } from "./staff-capabilities.js";

const PUBLISHED = new Date("2026-03-01T10:00:00Z");

const editionRun = {
  publishedAt: PUBLISHED,
  archivedAt: null,
  saleState: "for_sale" as const,
  eligibleForEditionAllocation: true,
  editionCount: 24,
  soldEditionCount: 3,
};

describe("artwork catalogue state", () => {
  it("is live once published with something left to sell", () => {
    expect(artworkCatalogueState(editionRun)).toBe("live");
  });

  it("is a draft until published", () => {
    expect(artworkCatalogueState({ ...editionRun, publishedAt: null })).toBe("draft");
  });

  it("is archived whatever else is true", () => {
    expect(artworkCatalogueState({ ...editionRun, publishedAt: null, archivedAt: PUBLISHED })).toBe(
      "archived",
    );
  });

  it("is sold out when every edition is sold", () => {
    expect(artworkCatalogueState({ ...editionRun, soldEditionCount: 24 })).toBe("sold_out");
  });

  it("keeps a new, unauthorised run live rather than sold out", () => {
    expect(isArtworkSoldOut({ ...editionRun, soldEditionCount: 0 })).toBe(false);
  });

  it("is sold out when an original is marked sold", () => {
    expect(
      artworkCatalogueState({
        ...editionRun,
        eligibleForEditionAllocation: false,
        editionCount: 0,
        soldEditionCount: 0,
        saleState: "sold",
      }),
    ).toBe("sold_out");
  });

  it("shows a sold draft as a draft, so staff see it is not on the storefront", () => {
    expect(artworkCatalogueState({ ...editionRun, publishedAt: null, soldEditionCount: 24 })).toBe(
      "draft",
    );
  });
});

describe("edition price", () => {
  it("accepts a positive whole-pence price on an edition run", () => {
    expect(() =>
      assertEditionPrice({ pricePence: 45_000, eligibleForEditionAllocation: true }),
    ).not.toThrow();
  });

  it("allows no price while the artwork is being prepared", () => {
    expect(() =>
      assertEditionPrice({ pricePence: null, eligibleForEditionAllocation: true }),
    ).not.toThrow();
  });

  it.each([0, -100, 12.5])("refuses %s pence", (pricePence) => {
    expect(() => assertEditionPrice({ pricePence, eligibleForEditionAllocation: true })).toThrow(
      "The edition price must be more than £0",
    );
  });

  it("refuses a price on an original", () => {
    expect(() =>
      assertEditionPrice({ pricePence: 45_000, eligibleForEditionAllocation: false }),
    ).toThrow("Originals are sold by enquiry");
  });

  it("refuses to clear the price of a live edition run on sale", () => {
    expect(() =>
      assertLivePriceKept({
        published: true,
        eligibleForEditionAllocation: true,
        saleState: "for_sale",
        printPricePence: null,
      }),
    ).toThrow("unpublish it first");
    expect(() =>
      assertLivePriceKept({
        published: true,
        eligibleForEditionAllocation: true,
        saleState: "price_on_application",
        printPricePence: null,
      }),
    ).not.toThrow();
  });
});

describe("publishing", () => {
  const ready = {
    archived: false,
    artistArchived: false,
    hasImage: true,
    eligibleForEditionAllocation: true,
    saleState: "for_sale" as const,
    printPricePence: 45_000,
  };

  it("has no blockers for a complete artwork", () => {
    expect(artworkPublishBlockers(ready)).toEqual([]);
    expect(() => assertArtworkPublishable(ready)).not.toThrow();
  });

  it("lists every blocker in a fixed order", () => {
    expect(
      artworkPublishBlockers({
        ...ready,
        archived: true,
        artistArchived: true,
        hasImage: false,
        printPricePence: null,
      }),
    ).toEqual(["archived", "artist_archived", "no_image", "no_edition_price"]);
  });

  it("needs no price for an original or a price-on-application run", () => {
    expect(
      artworkPublishBlockers({
        ...ready,
        eligibleForEditionAllocation: false,
        printPricePence: null,
      }),
    ).toEqual([]);
    expect(
      artworkPublishBlockers({
        ...ready,
        saleState: "price_on_application",
        printPricePence: null,
      }),
    ).toEqual([]);
  });

  it("explains the first blocker", () => {
    expect(() => assertArtworkPublishable({ ...ready, hasImage: false })).toThrow(
      "Add an image before publishing",
    );
  });
});

describe("edition run", () => {
  it("cannot be added or removed after creation", () => {
    expect(() => assertEditionRunUnchanged({ current: true, requested: false })).toThrow(
      "fixed when the artwork is created",
    );
    expect(() => assertEditionRunUnchanged({ current: false, requested: true })).toThrow();
    expect(() => assertEditionRunUnchanged({ current: true, requested: true })).not.toThrow();
  });

  it("summarises a fresh run by allocation and status", () => {
    const run = planEditionsForArtwork(true).map((edition) => ({
      allocation: edition.allocation,
      listingStatus: "not_authorised" as const,
    }));
    expect(summariseEditionRun(run)).toEqual({
      size: 24,
      byStatus: {
        not_authorised: 24,
        authorised: 0,
        reserved: 0,
        held: 0,
        sold: 0,
        withdrawn: 0,
      },
      byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
      committed: 0,
    });
  });

  it("counts sold, reserved and held editions as committed", () => {
    const summary = summariseEditionRun([
      { allocation: "lax", listingStatus: "sold" },
      { allocation: "lax", listingStatus: "reserved" },
      { allocation: "artist", listingStatus: "held" },
      { allocation: "artist", listingStatus: "authorised" },
    ]);
    expect(summary.committed).toBe(3);
    expect(summary.size).toBe(4);
  });

  it("is empty for an original", () => {
    expect(summariseEditionRun([]).size).toBe(0);
  });
});

describe("archiving an artist", () => {
  it("is allowed once nothing of theirs is published", () => {
    expect(() => assertArtistArchivable({ publishedArtworkCount: 0 })).not.toThrow();
  });

  it("names how many live artworks are in the way", () => {
    expect(() => assertArtistArchivable({ publishedArtworkCount: 1 })).toThrow(
      "the artist's live artwork first",
    );
    expect(() => assertArtistArchivable({ publishedArtworkCount: 3 })).toThrow(
      "the artist's 3 live artworks first",
    );
  });
});

describe("edition price capability", () => {
  it("is held by shop admins and finance only", () => {
    expect(roleHasCapability("shop_admin", "artwork_price.write")).toBe(true);
    expect(roleHasCapability("finance", "artwork_price.write")).toBe(true);
    for (const role of ["catalogue_editor", "account_manager", "broker", "operations"] as const) {
      expect(roleHasCapability(role, "artwork_price.write")).toBe(false);
    }
  });
});
