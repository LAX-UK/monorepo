/**
 * Bounded buyer-account web surface (dashboard, watchlists, notifications, preferences).
 * Name, email, addresses, sessions and security live in LAX Account. Prefer importing from here in dashboard/account routes;
 * implementations remain under `../data`, `../actions`, and `../services`.
 */

export type {
  ArtistFollowRow,
  BidWithLot,
  WatchlistListParams,
  WatchlistWithLotRow,
} from "../data/dto/dashboard-dtos";
export type { ProfileAddressRow } from "../data/dto/profile-dtos";
export {
  getServerMyArtistFollows,
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "../data/http/dashboard.server";
export { getServerWatchedLotIdSet } from "../data/http/watchlist.server";
export { getServerMyArtistWatchIds } from "../data/http/artist-watchlist.server";
export { getServerMyNotificationPreferences } from "../data/http/notification-preferences.server";
export {
  getServerMyNotifications,
  getServerMyNotificationsSafe,
  type ListMyNotificationsParams,
} from "../data/http/notifications.server";
export { getServerSessionUser } from "../data/http/session.server";
export type { SessionUser } from "../data/contracts";
export {
  portfolioComplianceReason,
  portfolioSettlementAttentionAction,
  portfolioSettlementLabel,
} from "../portfolio-settlement";
export { useWatchlistToggle } from "../watchlist/use-watchlist-toggle";
export type { MyPaymentRow } from "../data/http/payments.schema";
