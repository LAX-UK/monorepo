import type { ArtworkCatalogueReader } from "../ports/artwork-catalogue.reader.js";

export type GetPublicArtworkHandler = (
  slug: string,
) => ReturnType<ArtworkCatalogueReader["getPublicArtworkBySlug"]>;

export function createGetPublicArtworkHandler(
  reader: ArtworkCatalogueReader,
): GetPublicArtworkHandler {
  return (slug) => reader.getPublicArtworkBySlug(slug);
}
