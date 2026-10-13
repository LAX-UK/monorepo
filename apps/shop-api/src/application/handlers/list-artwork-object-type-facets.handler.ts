import type { ArtworkCatalogueReader } from "../ports/artwork-catalogue.reader.js";

export type ListArtworkObjectTypeFacetsHandler = (
  salesChannel: "shop" | "art",
) => ReturnType<ArtworkCatalogueReader["listObjectTypeFacets"]>;

export function createListArtworkObjectTypeFacetsHandler(
  reader: ArtworkCatalogueReader,
): ListArtworkObjectTypeFacetsHandler {
  return (salesChannel) => reader.listObjectTypeFacets({ salesChannel });
}
