/**
 * @deprecated Prefer `@/lib/buyer-account` for dashboard/account server loaders.
 */
export type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
export {
  getServerMyArtistFollows,
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.reader";
