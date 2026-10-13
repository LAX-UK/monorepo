import type { CatalogueCursor } from "../catalogue-cursor.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

export type PublicArtistSort = "newest" | "nameAsc" | "nameDesc";

export type ListPublicArtistsInput = {
  limit: number;
  cursor?: CatalogueCursor;
  placement?: "featured_artists";
  /** Case-insensitive match on artist name or slug; ignored for curated placements. */
  q?: string;
  /** First letter of the artist name (A–Z). */
  letter?: string;
  sort?: PublicArtistSort;
  /** Only artists with at least one artwork in this channel; counts are scoped to it too. */
  salesChannel?: "shop" | "art";
};

export type ListPublicArtistsResult = {
  items: ArtistSummaryReadModel[];
  nextCursor?: CatalogueCursor;
};

export interface ArtistDirectoryReader {
  listPublicArtists(input: ListPublicArtistsInput): Promise<ListPublicArtistsResult>;
  getPublicArtistBySlug(slug: string): Promise<ArtistDetailReadModel | null>;
}
