import type { CatalogueCursor } from "../catalogue-cursor.js";
import type {
  ArtistDetailReadModel,
  ArtistSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

export type ListPublicArtistsInput = {
  limit: number;
  cursor?: CatalogueCursor;
  placement?: "featured_artists";
};

export type ListPublicArtistsResult = {
  items: ArtistSummaryReadModel[];
  nextCursor?: CatalogueCursor;
};

export interface ArtistDirectoryReader {
  listPublicArtists(input: ListPublicArtistsInput): Promise<ListPublicArtistsResult>;
  getPublicArtistBySlug(slug: string): Promise<ArtistDetailReadModel | null>;
}
