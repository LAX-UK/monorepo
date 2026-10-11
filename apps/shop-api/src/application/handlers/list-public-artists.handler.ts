import { decodeCatalogueCursor } from "../catalogue-cursor.js";
import type {
  ArtistDirectoryReader,
  ListPublicArtistsResult,
} from "../ports/artist-directory.reader.js";

export type ListPublicArtistsQuery = {
  limit: number;
  cursor?: string;
  placement?: "featured_artists";
  q?: string;
};

export type ListPublicArtistsHandler = (
  input: ListPublicArtistsQuery,
) => Promise<ListPublicArtistsResult>;

export function createListPublicArtistsHandler(
  reader: ArtistDirectoryReader,
): ListPublicArtistsHandler {
  return (input) => {
    const cursor = decodeCatalogueCursor(input.cursor);
    const q = input.q?.trim();
    return reader.listPublicArtists({
      limit: input.limit,
      ...(cursor ? { cursor } : {}),
      ...(input.placement ? { placement: input.placement } : {}),
      ...(q ? { q } : {}),
    });
  };
}
