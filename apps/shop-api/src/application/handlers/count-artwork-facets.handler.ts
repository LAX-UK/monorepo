import {
  type RawArtworkCatalogueFilters,
  normalizeArtworkCatalogueFilters,
} from "../artwork-catalogue-filters.js";
import type { ArtworkCatalogueReader } from "../ports/artwork-catalogue.reader.js";

export type CountArtworkFacetsHandler = (
  filter: RawArtworkCatalogueFilters,
) => ReturnType<ArtworkCatalogueReader["countFacets"]>;

/** Filter option counts for the same filters the list takes. */
export function createCountArtworkFacetsHandler(
  reader: ArtworkCatalogueReader,
): CountArtworkFacetsHandler {
  return (filter) => reader.countFacets(normalizeArtworkCatalogueFilters(filter));
}
