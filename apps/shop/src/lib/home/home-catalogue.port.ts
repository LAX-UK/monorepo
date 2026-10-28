import type {
  PublicArtistList,
  PublicArtworkFacetCounts,
  PublicArtworkList,
} from "@auction/shop-contracts";

/** A list of Shop editions; every field narrows the list. Prices are in pence. */
export type HomeEditionQuery = {
  limit: number;
  placement?: "featured_prints";
  availability?: "available";
  categorySlug?: string;
  maxPrice?: number;
  sort?: "priceAsc";
};

export type HomeArtistQuery = { limit: number; placement?: "featured_artists" };

/**
 * What the home page reads from the catalogue. The composer depends on this, not on the HTTP
 * client, so the home page's rules are tested without the network.
 */
export type HomeCatalogueReader = {
  listEditions(query: HomeEditionQuery): Promise<PublicArtworkList>;
  /** Counts by availability, category and artist across the Shop channel. */
  countFacets(): Promise<PublicArtworkFacetCounts>;
  listArtists(query: HomeArtistQuery): Promise<PublicArtistList>;
};
