import { decodeArtworkListCursor } from "../artwork-catalogue-cursor.js";
import {
  type NormalizedArtworkCatalogueFilters,
  type RawArtworkCatalogueFilters,
  normalizeArtworkCatalogueFilters,
} from "../artwork-catalogue-filters.js";
import { DEFAULT_ARTWORK_CATALOGUE_SORT } from "../artwork-catalogue-sort.js";
import type {
  ArtworkCatalogueReader,
  ListPublicArtworksResult,
} from "../ports/artwork-catalogue.reader.js";

export type ListPublicArtworksQuery = {
  limit: number;
  cursor?: string;
  filter?: RawArtworkCatalogueFilters;
};

export type ListPublicArtworksHandler = (
  input: ListPublicArtworksQuery,
) => Promise<ListPublicArtworksResult>;

export function createListPublicArtworksHandler(
  reader: ArtworkCatalogueReader,
): ListPublicArtworksHandler {
  return (input) => {
    const filter: NormalizedArtworkCatalogueFilters | undefined = input.filter
      ? normalizeArtworkCatalogueFilters(input.filter)
      : undefined;
    const sort = filter?.sort ?? DEFAULT_ARTWORK_CATALOGUE_SORT;
    const cursor = decodeArtworkListCursor(input.cursor, sort);
    return reader.listPublicArtworks({
      limit: input.limit,
      ...(cursor ? { cursor } : {}),
      ...(filter ? { filter } : {}),
    });
  };
}
