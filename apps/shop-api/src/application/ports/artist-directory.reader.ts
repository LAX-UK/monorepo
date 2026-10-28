import type { CatalogueCursor, NameCursor } from "../catalogue-cursor.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

/**
 * `latestEdition` orders artists by their most recently listed work (in the sales channel, and
 * among works on sale now when `hasAvailableEditions` is set). It returns one page, no cursor.
 */
export type PublicArtistSort = "newest" | "nameAsc" | "nameDesc" | "latestEdition";

export type ListPublicArtistsInput = {
  limit: number;
  /** Position for the newest-first sort. */
  cursor?: CatalogueCursor;
  /** Position for the name sorts. */
  nameCursor?: NameCursor;
  placement?: "featured_artists";
  /** Case-insensitive match on artist name or slug; ignored for curated placements. */
  q?: string;
  /** First letter of the artist name (A–Z). */
  letter?: string;
  sort?: PublicArtistSort;
  /** Only artists with at least one artwork in this channel; counts are scoped to it too. */
  salesChannel?: "shop" | "art";
  /**
   * Only artists with at least one work that can be bought now (in `salesChannel` when given).
   * Applies to curated placements too, so a featured artist with nothing on sale drops out.
   */
  hasAvailableEditions?: boolean;
};

export type ListPublicArtistsResult = {
  items: ArtistSummaryReadModel[];
  /** Artists matching the filters across all pages; absent for curated placements. */
  total?: number;
  nextCursor?: CatalogueCursor;
  nextNameCursor?: NameCursor;
};

export interface ArtistDirectoryReader {
  listPublicArtists(input: ListPublicArtistsInput): Promise<ListPublicArtistsResult>;
  getPublicArtistBySlug(slug: string): Promise<ArtistDetailReadModel | null>;
}
