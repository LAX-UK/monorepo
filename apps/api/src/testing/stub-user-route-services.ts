import { vi } from "vitest";
import type { UserRouteServices } from "../services/interfaces/user-routes/index.js";

const EMPTY_CATEGORY_INTERESTS = {
  status: 200,
  body: {
    data: { categoryIds: [], onboardingCompleted: false, onboardingCompletedAt: null },
  },
} as const;

export function stubUserRouteServices(overrides?: Partial<UserRouteServices>): UserRouteServices {
  return {
    categoryInterestsHttp: {
      getForUser: vi.fn().mockResolvedValue(EMPTY_CATEGORY_INTERESTS),
      replacePreferences: vi.fn().mockResolvedValue(EMPTY_CATEGORY_INTERESTS),
      replaceAndComplete: vi.fn().mockResolvedValue(EMPTY_CATEGORY_INTERESTS),
    },
    publicHttp: {
      listPublicArtists: vi.fn(),
      getPublicUserProfile: vi.fn(),
    },
    dashboardHttp: {
      listConditionReportRequests: vi.fn(),
      listBids: vi.fn(),
      listPortfolio: vi.fn(),
      listAccountBids: vi.fn(),
      listAccountPurchases: vi.fn(),
    },
    lotStatesHttp: { list: vi.fn() },
    laxPortfolioHttp: {
      getPortfolio: vi.fn(),
      getMoney: vi.fn(),
    },
    watchlistHttp: {
      listWatchlistIds: vi.fn(),
      listWatchlist: vi.fn(),
      addWatchlistLot: vi.fn(),
      removeWatchlistLot: vi.fn(),
      listArtistWatchlist: vi.fn(),
      addArtistWatchlist: vi.fn(),
      removeArtistWatchlist: vi.fn(),
      setArtistAlert: vi.fn(),
      listSavedSearches: vi.fn(),
      createSavedSearch: vi.fn(),
      removeSavedSearch: vi.fn(),
    },
    watchlistRemindersHttp: { list: vi.fn(), set: vi.fn(), clear: vi.fn() },
    notificationsHttp: {
      listNotifications: vi.fn(),
      countNotifications: vi.fn(),
      markManyRead: vi.fn(),
      archiveNotification: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      listMutes: vi.fn(),
      muteAccount: vi.fn(),
      unmuteAccount: vi.fn(),
    },
    preferencesHttp: {
      getVapidPublicKey: vi
        .fn()
        .mockReturnValue({ status: 200, body: { data: { publicKey: null } } }),
      getPushSubscriptionStatus: vi.fn(),
      getNotificationPreferences: vi.fn(),
      patchNotificationPreferences: vi.fn(),
      patchBiddingPreferences: vi.fn(),
      getUiPreferences: vi.fn(),
      patchUiPreferences: vi.fn(),
      resetUiLayout: vi.fn(),
      createPushSubscription: vi.fn(),
      removePushSubscription: vi.fn(),
    },
    profileHttp: {
      updateProfile: vi.fn(),
      listAddresses: vi.fn(),
      createAddress: vi.fn(),
      updateAddress: vi.fn(),
      deleteAddress: vi.fn(),
      setDefaultAddress: vi.fn(),
      getMe: vi.fn(),
    },
    accountOnboardingHttp: {
      complete: vi.fn(),
    },
    securityHttp: {
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      revokeAllSessionsExceptCurrent: vi.fn(),
      requestAccountDeletion: vi.fn(),
    },
    twoFactorRequirement: { readMyRequirement: vi.fn() },
    staffInvitationAccept: { accept: vi.fn() },
    requireBuyingAccount: async (_c, next) => {
      await next();
    },
    ...overrides,
  };
}
