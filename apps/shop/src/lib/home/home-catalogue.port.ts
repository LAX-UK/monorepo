import type {
  PublicArtistDetail,
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
  minPrice?: number;
  maxPrice?: number;
  sort?: "priceAsc";
};

/**
 * Artists with Shop editions. `hasAvailableEditions` keeps only artists with an edition on sale
 * now; `latestEdition` orders them by their newest listing.
 */
export type HomeArtistQuery = {
  limit: number;
  placement?: "featured_artists";
  hasAvailableEditions?: true;
  sort?: "latestEdition";
};

/**
 * What the home page reads from the catalogue. The composer depends on this, not on the HTTP
 * client, so the home page's rules are tested without the network.
 */
export type HomeCatalogueReader = {
  listEditions(query: HomeEditionQuery): Promise<PublicArtworkList>;
  /** Counts by availability, category and artist across the Shop channel. */
  countFacets(): Promise<PublicArtworkFacetCounts>;
  listArtists(query: HomeArtistQuery): Promise<PublicArtistList>;
  /** One artist's profile, for the section that features a single artist. */
  getArtist(slug: string): Promise<PublicArtistDetail | null>;
};
