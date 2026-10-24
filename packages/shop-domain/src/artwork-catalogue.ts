import type { EditionAllocationKind } from "./edition-allocation.js";
import type { EditionListingStatus } from "./edition-listing-state.js";
import { ShopDomainError } from "./shop-domain-error.js";

/** Where an artwork stands for staff: on the storefront, not yet, gone from sale, or withdrawn. */
export const ARTWORK_CATALOGUE_STATES = ["live", "draft", "sold_out", "archived"] as const;
export type ArtworkCatalogueState = (typeof ARTWORK_CATALOGUE_STATES)[number];

export type ArtworkSaleState = "for_sale" | "price_on_application" | "sold";

export type ArtworkStateInput = {
  publishedAt: Date | null;
  archivedAt: Date | null;
  saleState: ArtworkSaleState;
  eligibleForEditionAllocation: boolean;
  /** Editions in the run, and how many of them are sold. Both 0 for an original. */
  editionCount: number;
  soldEditionCount: number;
};

/**
 * Sold out means nothing is left to buy: an original marked sold, or an edition run whose every
 * edition is sold. Editions not yet authorised for sale are unsold, so a new run is not sold out.
 */
export function isArtworkSoldOut(input: Omit<ArtworkStateInput, "publishedAt" | "archivedAt">) {
  if (input.saleState === "sold") return true;
  return (
    input.eligibleForEditionAllocation &&
    input.editionCount > 0 &&
    input.soldEditionCount >= input.editionCount
  );
}

/** Archived wins over draft, draft over sold out: each says what staff must do next. */
export function artworkCatalogueState(input: ArtworkStateInput): ArtworkCatalogueState {
  if (input.archivedAt) return "archived";
  if (!input.publishedAt) return "draft";
  return isArtworkSoldOut(input) ? "sold_out" : "live";
}

/** Whole pence; staff enter pounds. Prices are for editions only: originals sell by enquiry. */
export function assertEditionPrice(input: {
  pricePence: number | null;
  eligibleForEditionAllocation: boolean;
}): void {
  if (input.pricePence === null) return;
  if (!input.eligibleForEditionAllocation) {
    throw new ShopDomainError("Originals are sold by enquiry and have no edition price");
  }
  if (!Number.isSafeInteger(input.pricePence) || input.pricePence <= 0) {
    throw new ShopDomainError("The edition price must be more than £0");
  }
}

export const ARTWORK_PUBLISH_BLOCKERS = [
  "archived",
  "artist_archived",
  "no_image",
  "no_edition_price",
] as const;
export type ArtworkPublishBlocker = (typeof ARTWORK_PUBLISH_BLOCKERS)[number];

export const ARTWORK_PUBLISH_BLOCKER_MESSAGES: Record<ArtworkPublishBlocker, string> = {
  archived: "Restore the artwork before publishing it",
  artist_archived: "The artist is archived; restore the artist first",
  no_image: "Add an image before publishing",
  no_edition_price: "Set the edition price before publishing",
};

/**
 * What stops an artwork going on the storefront. An edition run on sale needs a price, because
 * the storefront sells editions at that price; an original or a price-on-application run does not.
 */
export function artworkPublishBlockers(input: {
  archived: boolean;
  artistArchived: boolean;
  hasImage: boolean;
  eligibleForEditionAllocation: boolean;
  saleState: ArtworkSaleState;
  printPricePence: number | null;
}): ArtworkPublishBlocker[] {
  const blockers: ArtworkPublishBlocker[] = [];
  if (input.archived) blockers.push("archived");
  if (input.artistArchived) blockers.push("artist_archived");
  if (!input.hasImage) blockers.push("no_image");
  if (
    input.eligibleForEditionAllocation &&
    input.saleState === "for_sale" &&
    input.printPricePence === null
  ) {
    blockers.push("no_edition_price");
  }
  return blockers;
}

export function assertArtworkPublishable(input: Parameters<typeof artworkPublishBlockers>[0]) {
  const [first] = artworkPublishBlockers(input);
  if (first) throw new ShopDomainError(ARTWORK_PUBLISH_BLOCKER_MESSAGES[first]);
}

/**
 * A live edition run on sale must keep a price; clearing it would leave a storefront page that
 * cannot be bought. Unpublish first, or switch the run to price on application.
 */
export function assertLivePriceKept(input: {
  published: boolean;
  eligibleForEditionAllocation: boolean;
  saleState: ArtworkSaleState;
  printPricePence: number | null;
}): void {
  if (
    input.published &&
    input.eligibleForEditionAllocation &&
    input.saleState === "for_sale" &&
    input.printPricePence === null
  ) {
    throw new ShopDomainError("A live edition on sale needs a price; unpublish it first");
  }
}

/**
 * The edition run (1 to 24, split 10/10/4) is planned when the artwork is created and cannot be
 * added or removed later: editions are owned, authorised and sold one by one.
 */
export function assertEditionRunUnchanged(input: {
  current: boolean;
  requested: boolean;
}): void {
  if (input.current !== input.requested) {
    throw new ShopDomainError("The edition run is fixed when the artwork is created");
  }
}

/** An artist leaves the storefront only once none of their artworks is still published. */
export function assertArtistArchivable(input: { publishedArtworkCount: number }): void {
  if (input.publishedArtworkCount > 0) {
    throw new ShopDomainError(
      input.publishedArtworkCount === 1
        ? "Unpublish or archive the artist's live artwork first"
        : `Unpublish or archive the artist's ${input.publishedArtworkCount} live artworks first`,
    );
  }
}

export type EditionRunSummary = {
  size: number;
  byStatus: Record<EditionListingStatus, number>;
  byAllocation: Record<EditionAllocationKind, number>;
  /** Sold, reserved in a checkout, or held for a client: no longer free to sell. */
  committed: number;
};

const EMPTY_STATUS: Record<EditionListingStatus, number> = {
  not_authorised: 0,
  authorised: 0,
  reserved: 0,
  held: 0,
  sold: 0,
  withdrawn: 0,
};

const EMPTY_ALLOCATION: Record<EditionAllocationKind, number> = {
  original_buyer_entitlement: 0,
  artist: 0,
  lax: 0,
};

/** Staff-only counts for an edition run. Never part of a public response. */
export function summariseEditionRun(
  editions: ReadonlyArray<{
    listingStatus: EditionListingStatus;
    allocation: EditionAllocationKind;
  }>,
): EditionRunSummary {
  const byStatus = { ...EMPTY_STATUS };
  const byAllocation = { ...EMPTY_ALLOCATION };
  for (const edition of editions) {
    byStatus[edition.listingStatus] += 1;
    byAllocation[edition.allocation] += 1;
  }
  return {
    size: editions.length,
    byStatus,
    byAllocation,
    committed: byStatus.sold + byStatus.reserved + byStatus.held,
  };
}
