import { decodeCatalogueCursor, decodeNameCursor } from "../catalogue-cursor.js";
import type {
  ArtistDirectoryReader,
  ListPublicArtistsResult,
  PublicArtistSort,
} from "../ports/artist-directory.reader.js";

export type ListPublicArtistsQuery = {
  limit: number;
  cursor?: string;
  placement?: "featured_artists";
  q?: string;
  letter?: string;
  sort?: PublicArtistSort;
  salesChannel?: "shop" | "art";
};

export type ListPublicArtistsHandler = (
  input: ListPublicArtistsQuery,
) => Promise<ListPublicArtistsResult>;

export function createListPublicArtistsHandler(
  reader: ArtistDirectoryReader,
): ListPublicArtistsHandler {
  return (input) => {
    const byName = input.sort === "nameAsc" || input.sort === "nameDesc";
    const cursor = byName ? null : decodeCatalogueCursor(input.cursor);
    const nameCursor = byName ? decodeNameCursor(input.cursor) : null;
    const q = input.q?.trim();
    const letter = input.letter?.trim().toUpperCase();
    return reader.listPublicArtists({
      limit: input.limit,
      ...(cursor ? { cursor } : {}),
      ...(nameCursor ? { nameCursor } : {}),
      ...(input.placement ? { placement: input.placement } : {}),
      ...(q ? { q } : {}),
      ...(letter && /^[A-Z]$/.test(letter) ? { letter } : {}),
      ...(input.sort ? { sort: input.sort } : {}),
      ...(input.salesChannel ? { salesChannel: input.salesChannel } : {}),
    });
  };
}
