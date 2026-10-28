import type {
  AdminArtworkBulkVisibilityResponse,
  AdminArtworkChannel,
  AdminArtworkDetail,
  AdminArtworkListItem,
  AdminArtworkSaleState,
  AdminArtworkState,
  AdminArtworkVersionResponse,
  AdminArtworkVisibilityAction,
  AdminNewRunInput,
} from "@auction/shop-contracts";
import type { CursorListInput, CursorListResult } from "./cursor-list.js";

export type AdminArtworkListInput = CursorListInput & {
  /** Title or artist name, anywhere in the text. */
  q?: string | undefined;
  state?: AdminArtworkState | undefined;
  sort?: "updated_desc" | "updated_asc" | undefined;
  artistId?: string | undefined;
  saleState?: AdminArtworkSaleState | undefined;
  salesChannel?: AdminArtworkChannel | undefined;
  /** Runs whose edition facts are not recorded or not confirmed yet. */
  facts?: "needs_review" | undefined;
};

export type AdminArtworkListResult = CursorListResult<AdminArtworkListItem> & {
  /** Matches per state under every filter except `state`. */
  counts: Record<AdminArtworkState, number>;
};

/** Staff reads of the artwork catalogue: drafts and archived works included, with edition counts. */
export interface AdminArtworkReader {
  listArtworks(input: AdminArtworkListInput): Promise<AdminArtworkListResult>;
  getArtwork(artworkId: string): Promise<AdminArtworkDetail | null>;
}

/**
 * True when the committed change alters what lax.art serves, so its cached catalogue should be
 * refreshed. Not part of any HTTP response.
 */
export type ArtRefresh = { refreshesArt: boolean };

type StaffWrite = {
  actorSubjectId: string;
  idempotencyKey: string;
};

export type ArtworkEditableFields = {
  title: string;
  artistId: string;
  yearCreated: number | null;
  medium: string | null;
  dimensions: string | null;
  description: string | null;
  printPricePence: number | null;
  saleState: AdminArtworkSaleState;
  salesChannel: AdminArtworkChannel;
  images: ReadonlyArray<{ mediaKey: string; alt: string | null }>;
  /** The original an edition was made from; null clears it, undefined leaves it unchanged. */
  sourceOriginalArtworkId?: string | null | undefined;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** Whether this person may set or change an edition price (`artwork_price.write`). */
type PriceAuthority = { canSetPrice: boolean };

export type CreateArtworkInput = StaffWrite &
  ArtworkEditableFields &
  PriceAuthority & {
    slug: string;
    /** The run of prints the artwork sells, recorded with it; null for an original. */
    run: AdminNewRunInput | null;
  };

export type UpdateArtworkInput = StaffWrite &
  ArtworkEditableFields &
  PriceAuthority & {
    artworkId: string;
    /** The artwork's `updatedAt` when the editor opened it. */
    expectedVersion: string;
  };

/** The edition price alone, for staff with `artwork_price.write` but not `catalogue.write`. */
export type SetArtworkPriceInput = StaffWrite & {
  artworkId: string;
  printPricePence: number | null;
  expectedVersion: string;
};

export type SetArtworkVisibilityInput = StaffWrite & {
  artworkId: string;
  action: AdminArtworkVisibilityAction;
};

export type BulkArtworkVisibilityInput = StaffWrite & {
  artworkIds: readonly string[];
  action: AdminArtworkVisibilityAction;
};

/**
 * Staff edits to artworks. Nothing is deleted: editions, orders and sales reference artworks, so
 * withdrawing one is an archive. New artworks start as drafts. Every change writes an audit entry.
 *
 * Throws `ShopApiError` for a missing row (404), a taken slug (409) or a price change without
 * `artwork_price.write` (403); `StaleVersionError` for an out-of-date `expectedVersion`; and
 * `ShopDomainError` (409) when a catalogue rule refuses the change.
 */
export interface ArtworkCatalogueWriter {
  createArtwork(
    input: CreateArtworkInput,
  ): Promise<{ artworkId: string; slug: string; version: string } & ArtRefresh>;
  updateArtwork(input: UpdateArtworkInput): Promise<{ version: string } & ArtRefresh>;
  setPrice(input: SetArtworkPriceInput): Promise<{ version: string } & ArtRefresh>;
  setVisibility(
    input: SetArtworkVisibilityInput,
  ): Promise<AdminArtworkVersionResponse & ArtRefresh>;
  /** One transaction; each artwork gets its own outcome so one refusal never blocks the rest. */
  applyBulkVisibility(
    input: BulkArtworkVisibilityInput,
  ): Promise<AdminArtworkBulkVisibilityResponse & ArtRefresh>;
}

export type CreateArtistInput = StaffWrite & {
  displayName: string;
  slug: string;
  discipline: string | null;
};

/** Staff edits to artists: create, and archive or restore. Artists are never deleted. */
export interface ArtistCatalogueWriter {
  createArtist(input: CreateArtistInput): Promise<{ artistId: string; slug: string }>;
  setArtistArchived(
    input: StaffWrite & { artistId: string; archived: boolean },
  ): Promise<{ artistId: string; archived: boolean } & ArtRefresh>;
}
