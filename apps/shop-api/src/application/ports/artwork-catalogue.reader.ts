import type { ArtworkListCursor } from "../artwork-catalogue-cursor.js";
import type { NormalizedArtworkCatalogueFilters } from "../artwork-catalogue-filters.js";
import type {
  ArtworkDetailReadModel,
  ArtworkFacetCountsReadModel,
  ArtworkObjectTypeFacetReadModel,
  ArtworkSummaryReadModel,
} from "../read-models/catalogue.read-model.js";

export type ListPublicArtworksFilter = NormalizedArtworkCatalogueFilters;

export type ListPublicArtworksInput = {
  limit: number;
  cursor?: ArtworkListCursor;
  filter?: ListPublicArtworksFilter;
};

export type ListPublicArtworksResult = {
  items: ArtworkSummaryReadModel[];
  nextCursor?: ArtworkListCursor;
  totalCount?: number;
};

export interface ArtworkCatalogueReader {
  listPublicArtworks(input: ListPublicArtworksInput): Promise<ListPublicArtworksResult>;
  getPublicArtworkBySlug(slug: string): Promise<ArtworkDetailReadModel | null>;
  /** Option counts for the catalogue filters; options with no works are left out. */
  countFacets(filter: ListPublicArtworksFilter): Promise<ArtworkFacetCountsReadModel>;
  /** Object types with at least one work on the channel, in canonical type order. */
  listObjectTypeFacets(input: {
    salesChannel: "shop" | "art";
  }): Promise<ArtworkObjectTypeFacetReadModel[]>;
}
