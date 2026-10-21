import type { ArtViewerState } from "@/lib/art-viewer-state";
import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionList,
  ArtEditorialFetchResult,
  ArtEditorialPageDetail,
  ArtEditorialPageList,
  ArtEditorialPreview,
  ArtEditorialStoryDetail,
  ArtEditorialStoryList,
  ArtEditorialVenueDetail,
  ArtEditorialVenueList,
  ArtExhibitionStatus,
  ArtStoryKind,
} from "@/lib/editorial/art-editorial.types";
import type {
  EditorialHomeResponse,
  GeneralEnquiryRow,
  PortalCollectionItem,
  PortalEnquiry,
  PortalFollowedArtist,
  PortalSavedArtwork,
  PublicArtistDetail,
  PublicArtistList,
  PublicArtworkDetail,
  PublicArtworkList,
  PublicArtworkObjectTypeFacetList,
  PublicCategoryList,
} from "@auction/shop-contracts";
import type { PortalPayeeConnectView, ShopPortalFetchResult } from "@auction/shop-portal/portal";

export type ArtArtworkListQuery = {
  limit?: number;
  cursor?: string;
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  /** Works by any of these artists. */
  artistSlugs?: readonly string[];
  saleState?: "for_sale" | "price_on_application" | "sold";
  editionEligible?: boolean;
  type?: "all" | "original" | "edition";
  /** Works of any of these media. */
  objectTypes?: ReadonlyArray<
    "painting" | "work_on_paper" | "sculpture" | "photography" | "print" | "mixed_media"
  >;
  /** Works of any of these rarities. */
  rarities?: ReadonlyArray<"unique" | "limited_edition" | "open_edition">;
  /** Works sharing a category with this artwork slug (the anchor itself is excluded). */
  relatedTo?: string;
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
  sort?: "newest" | "nameAsc" | "nameDesc";
  /** First letter A–Z of the artist name. */
  letter?: string;
};

/** Public lax.art catalogue reads (shop-api, salesChannel=art). */
export type ArtCataloguePort = {
  listArtworks(query: ArtArtworkListQuery): Promise<PublicArtworkList>;
  getArtwork(slug: string): Promise<PublicArtworkDetail | null>;
  listArtists(query: ArtArtistListQuery): Promise<PublicArtistList>;
  getArtist(slug: string): Promise<PublicArtistDetail | null>;
  listCategories(query?: { limit?: number }): Promise<PublicCategoryList>;
  /** Medium tiles: object types with works on lax.art, each with a cover image. */
  listArtworkObjectTypes(): Promise<PublicArtworkObjectTypeFacetList>;
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
  listGeneralEnquiries(): Promise<ShopPortalFetchResult<GeneralEnquiryRow[]>>;
  listCollection(): Promise<ShopPortalFetchResult<PortalCollectionItem[]>>;
  loadPayeeConnect(): Promise<ShopPortalFetchResult<PortalPayeeConnectView>>;
};

export type ArtAccountConfigPort = {
  /** LAX Account profile editor; null hides the link (env-only, no hardcoded fallback). */
  laxAccountHref(): string | null;
  verifyEmailHref(): string;
  payoutsEnabled(): boolean;
};

/** Editorial reads from shop-api `/v1/editorial/*`; every read reports `disabled` when `ART_EDITORIAL_ENABLED` is off. */
export type ArtEditorialPort = {
  enabled(): boolean;
  home(): Promise<ArtEditorialFetchResult<EditorialHomeResponse>>;
  listExhibitions(
    status: ArtExhibitionStatus,
  ): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionList>>;
  getExhibition(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionDetail>>;
  listStories(kind?: ArtStoryKind): Promise<ArtEditorialFetchResult<ArtEditorialStoryList>>;
  getStory(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialStoryDetail>>;
  listPages(): Promise<ArtEditorialFetchResult<ArtEditorialPageList>>;
  getPage(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialPageDetail>>;
  listVenues(): Promise<ArtEditorialFetchResult<ArtEditorialVenueList>>;
  getVenue(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialVenueDetail>>;
  preview(token: string): Promise<ArtEditorialFetchResult<ArtEditorialPreview>>;
};
