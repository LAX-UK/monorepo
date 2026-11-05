import type { ArtListingFacts, OfferRef, OfferState } from "@auction/artwork-register-contracts";
import type { ListingLot } from "@auction/persistence/interfaces";
import type { ListingFacts } from "./listing-facts.js";
import { ListingLinks } from "./listing-links.js";

export const REGISTER_ID = "6f1c1d0e-0000-4000-8000-000000000001";
export const PRODUCT_ID = "1023341000017963001";
export const LOT_ID = "7a2b3c4d-0000-4000-8000-000000000012";
export const ARTWORK_ID = "33333333-3333-4333-8333-333333333333";

export const links = new ListingLinks({
  artPublicUrl: "https://lax.art",
  laxAdminUrl: "https://admin.lax.art/",
  bidPublicUrl: "https://lax.bid",
});

export function lotIn(
  status: ListingLot["status"],
  saleStatus: NonNullable<ListingLot["sale"]>["status"] | null = "scheduled",
  over: Partial<ListingLot> = {},
): ListingLot {
  return {
    id: LOT_ID,
    title: "Harbour at dusk",
    lotNumber: 12,
    status,
    deleted: false,
    sale:
      saleStatus === null
        ? null
        : {
            id: "8b000000-0000-4000-8000-000000000001",
            title: "Autumn Modern",
            status: saleStatus,
            startTime: new Date("2026-11-12T18:00:00Z"),
            endTime: new Date("2026-11-14T20:00:00Z"),
            isTest: false,
          },
    ...over,
  };
}

export function laxArtListing(over: Partial<ArtListingFacts> = {}): ArtListingFacts {
  return {
    zohoProductId: PRODUCT_ID,
    artworkId: ARTWORK_ID,
    slug: "harbour-at-dusk",
    published: true,
    publishedAt: "2026-11-01T10:00:00.000Z",
    archived: false,
    ...over,
  };
}

/** One original's facts; defaults to held with nothing linked. */
export function factsFor(
  state: OfferState,
  ref: OfferRef | null = null,
  over: Partial<ListingFacts> = {},
): ListingFacts {
  return {
    entry: {
      id: REGISTER_ID,
      zohoProductId: PRODUCT_ID,
      stockCode: "LAX-ORI-AR-PC-26-0001",
      kind: "original",
      sourceOriginalId: null,
      title: "Harbour at dusk",
      artist: { zohoArtistId: "1", name: "Ada Rowe", code: "AR" },
      medium: null,
      dimensions: null,
      year: 2026,
      imageRefs: [],
      catalogueStatus: "Available",
      offer: { state, ref },
      zohoModifiedAt: null,
      version: 3,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-04T00:00:00Z"),
    } as ListingFacts["entry"],
    lastMove: null,
    lot: null,
    privateSale: null,
    laxArt: null,
    ...over,
  };
}
