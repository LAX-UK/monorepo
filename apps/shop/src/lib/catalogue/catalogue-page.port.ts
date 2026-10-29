import type { ArtworkCatalogueFetchInput } from "@/lib/catalogue/artwork-catalogue-params";
import type {
  PublicArtistList,
  PublicArtworkFacetCounts,
  PublicArtworkList,
} from "@auction/shop-contracts";

/** One page of the Shop catalogue; prices in pence. */
export type CatalogueListQuery = ArtworkCatalogueFetchInput & { limit: number; cursor?: string };

/** The filters a set of counts is for (the list's filters, without the sort). */
export type CatalogueFacetQuery = Omit<ArtworkCatalogueFetchInput, "sort">;

/**
 * What the catalogue page reads. The composer depends on this, not on the HTTP client, so the
 * page's rules (sold-out last, empty and error states, suggestions) are tested without I/O.
 */
export type CatalogueReader = {
  listEditions(query: CatalogueListQuery): Promise<PublicArtworkList>;
  countFacets(query: CatalogueFacetQuery): Promise<PublicArtworkFacetCounts>;
  /** Artists with Shop editions whose name matches a search. */
  searchArtists(q: string, limit: number): Promise<PublicArtistList>;
  listCategories(): Promise<ReadonlyArray<{ slug: string; label: string }>>;
};
