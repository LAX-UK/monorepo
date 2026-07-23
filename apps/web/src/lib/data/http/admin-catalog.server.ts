/** Backward-compatible re-exports for admin catalog HTTP module. */
export {
  parseAdminArtistListRow,
  parseAdminArtistStats,
  parseAdminCategory,
  parseArtistDeleteEligibility,
  parseArtistProfile,
} from "./admin-catalog.mapper";
export {
  ADMIN_ARTIST_LIST_MAX_LIMIT,
  type AdminArtistDuplicateHit,
  type GetAdminCategoryPageParams,
  type GetAdminArtistListParams,
} from "./admin-catalog.types";
export {
  getAdminArtistById,
  getAdminArtistDeleteEligibility,
  getAdminArtistDuplicateCandidates,
  getAdminArtistList,
  getAdminArtistsByOwnerUserId,
  getAdminArtistStats,
  getAdminCategoryById,
  getAdminCategoriesListSummary,
  getAdminCategoryList,
  getAdminCategoryPage,
  searchAdminArtistsRegistry,
} from "./admin-catalog.reader";
