import type { ArtViewerState } from "@/lib/art-viewer-state";
import type {
  ArtEditorialArtistRelations,
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
  ArtStoryListFilter,
} from "@/lib/editorial/art-editorial.types";
import type { ArtHelpArticleFilter } from "@/lib/help/art-help.types";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { LaxAccountDestination } from "@auction/lax-ecosystem/lax-account-origin";
import type {
  EditorialHomeResponse,
  GeneralEnquiryRow,
  HelpArticleDetail,
  HelpArticleSummary,
  HelpCategorySummary,
  PortalEnquiry,
  PortalFollowedArtist,
  PortalSavedArtwork,
  PortalSellerAccess,
  PublicArtistDetail,
  PublicArtistList,
  PublicArtworkDetail,
  PublicArtworkList,
  PublicArtworkObjectTypeFacetList,
  PublicCategoryList,
} from "@auction/shop-contracts";
import type { ShopPortalFetchResult } from "@auction/shop-portal/portal";

export type ArtArtworkListQuery = {
  limit?: number;
  cursor?: string;
  placement?: "featured_originals";
  categorySlug?: string;
  /** Works by any of these artists. */
  artistSlugs?: readonly string[];
  /** `available` is every work that is not sold: for sale or price on request. */
  saleState?: "for_sale" | "price_on_application" | "sold" | "available";
  /** Works of any of these media. */
  objectTypes?: ReadonlyArray<
    "painting" | "work_on_paper" | "sculpture" | "photography" | "print" | "mixed_media"
  >;
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

/** Public lax.art catalogue reads (shop-api, salesChannel=art): originals only, by shop-api's rule. */
export type ArtCataloguePort = {
  listArtworks(query: ArtArtworkListQuery): Promise<PublicArtworkList>;
  getArtwork(slug: string): Promise<PublicArtworkDetail | null>;
  listArtists(query: ArtArtistListQuery): Promise<PublicArtistList>;
  getArtist(slug: string): Promise<PublicArtistDetail | null>;
  listCategories(query?: { limit?: number }): Promise<PublicCategoryList>;
  /** Medium tiles: object types with works on lax.art, each with a cover image. */
  listArtworkObjectTypes(): Promise<PublicArtworkObjectTypeFacetList>;
  /** LAX Shop editions made from the original with this slug. */
  listShopEditionsOfOriginal(originalSlug: string, limit: number): Promise<PublicArtworkList>;
  /** LAX Shop editions by the artist with this slug (the Shop and lax.art share artists). */
  listShopEditionsByArtist(artistSlug: string, limit: number): Promise<PublicArtworkList>;
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
  /** Which seller tools the person can use, so Payouts shows only to payees. */
  loadSellerAccess(): Promise<ShopPortalFetchResult<PortalSellerAccess>>;
};

export type ArtAccountConfigPort = {
  /** A LAX Account page: profile, collection and money live there, not on lax.art. */
  laxAccountUrl(page: LaxAccountDestination): string;
  verifyEmailHref(): string;
};

/** Editorial reads from shop-api `/v1/editorial/*`; every read reports `disabled` when `ART_EDITORIAL_ENABLED` is off. */
export type ArtEditorialPort = {
  enabled(): boolean;
  home(): Promise<ArtEditorialFetchResult<EditorialHomeResponse>>;
  listExhibitions(
    status: ArtExhibitionStatus,
  ): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionList>>;
  getExhibition(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionDetail>>;
  listStories(filter?: ArtStoryListFilter): Promise<ArtEditorialFetchResult<ArtEditorialStoryList>>;
  getStory(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialStoryDetail>>;
  /** Exhibitions and stories that feature the artist; `not_found` for an unknown slug. */
  getArtistRelations(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialArtistRelations>>;
  listPages(): Promise<ArtEditorialFetchResult<ArtEditorialPageList>>;
  getPage(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialPageDetail>>;
  listVenues(): Promise<ArtEditorialFetchResult<ArtEditorialVenueList>>;
  getVenue(slug: string): Promise<ArtEditorialFetchResult<ArtEditorialVenueDetail>>;
  preview(token: string): Promise<ArtEditorialFetchResult<ArtEditorialPreview>>;
};

/** Help centre reads from shop-api `/v1/help/*`; like editorial, every read reports `disabled` when `ART_EDITORIAL_ENABLED` is off. */
export type ArtHelpPort = {
  /** Categories that have at least one published question, in display order. */
  listCategories(): Promise<ArtEditorialFetchResult<{ items: HelpCategorySummary[] }>>;
  listArticles(
    filter?: ArtHelpArticleFilter,
  ): Promise<ArtEditorialFetchResult<{ items: HelpArticleSummary[] }>>;
  getArticle(slug: string): Promise<ArtEditorialFetchResult<HelpArticleDetail>>;
};

/** Site search over published editorial (shop-api `?q=` on the exhibition and story lists). */
export type ArtEditorialSearchPort = {
  searchExhibitions(query: string): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionList>>;
  searchStories(query: string): Promise<ArtEditorialFetchResult<ArtEditorialStoryList>>;
};

/** Other LAX products, resolved from env by `@auction/lax-ecosystem`; empty when misconfigured. */
export type ArtEcosystemPort = {
  crossProductLinks(): LaxProductLinkVm[];
};
