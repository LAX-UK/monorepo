import type { ArtViewerState } from "@/lib/art-viewer-state";
import type {
  PortalCollectionItem,
  PortalEnquiry,
  PortalFollowedArtist,
  PortalSavedArtwork,
  PublicArtistDetail,
  PublicArtistList,
  PublicArtworkDetail,
  PublicArtworkList,
  PublicCategoryList,
} from "@auction/shop-contracts";
import type { PortalPayeeConnectView, ShopPortalFetchResult } from "@auction/shop-portal/portal";

export type ArtArtworkListQuery = {
  limit?: number;
  cursor?: string;
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  editionEligible?: boolean;
  type?: "all" | "original" | "edition";
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "titleAsc" | "priceAsc" | "priceDesc";
  q?: string;
};

export type ArtArtistListQuery = {
  limit?: number;
  cursor?: string;
  placement?: "featured_artists";
  q?: string;
};

/** Public lax.art catalogue reads (shop-api, salesChannel=art). */
export type ArtCataloguePort = {
  listArtworks(query: ArtArtworkListQuery): Promise<PublicArtworkList>;
  getArtwork(slug: string): Promise<PublicArtworkDetail | null>;
  listArtists(query: ArtArtistListQuery): Promise<PublicArtistList>;
  getArtist(slug: string): Promise<PublicArtistDetail | null>;
  listCategories(query?: { limit?: number }): Promise<PublicCategoryList>;
};

export type ArtViewerPort = {
  load(): Promise<ArtViewerState>;
};

/** Signed-in favorites reads through the art-identity BFF. */
export type ArtFavoritesReadPort = {
  savedArtworkSlugs(): Promise<ReadonlySet<string>>;
  followedArtistSlugs(): Promise<ReadonlySet<string>>;
  listSavedArtworks(): Promise<ShopPortalFetchResult<PortalSavedArtwork[]>>;
  listFollowedArtists(): Promise<ShopPortalFetchResult<PortalFollowedArtist[]>>;
};

export type ArtPortalReadPort = {
  listEnquiries(): Promise<ShopPortalFetchResult<PortalEnquiry[]>>;
  listCollection(): Promise<ShopPortalFetchResult<PortalCollectionItem[]>>;
  loadPayeeConnect(): Promise<ShopPortalFetchResult<PortalPayeeConnectView>>;
};

export type ArtAccountConfigPort = {
  /** LAX Account profile editor; null hides the link (env-only, no hardcoded fallback). */
  laxAccountHref(): string | null;
  verifyEmailHref(): string;
  payoutsEnabled(): boolean;
};
