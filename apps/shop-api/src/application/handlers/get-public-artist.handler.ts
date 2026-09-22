import type { ArtistDirectoryReader } from "../ports/artist-directory.reader.js";

export type GetPublicArtistHandler = (
  slug: string,
) => ReturnType<ArtistDirectoryReader["getPublicArtistBySlug"]>;

export function createGetPublicArtistHandler(
  reader: ArtistDirectoryReader,
): GetPublicArtistHandler {
  return (slug) => reader.getPublicArtistBySlug(slug);
}
