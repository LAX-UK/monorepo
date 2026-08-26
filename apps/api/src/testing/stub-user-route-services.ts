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
      register: vi.fn(),
      listPublicArtists: vi.fn(),
      getPublicUserProfile: vi.fn(),
    },
    dashboardHttp: {
      listConditionReportRequests: vi.fn(),
      listBids: vi.fn(),
      listPortfolio: vi.fn(),
    },
    watchlistHttp: {
      listWatchlistIds: vi.fn(),
      listWatchlist: vi.fn(),
      addWatchlistLot: vi.fn(),
      removeWatchlistLot: vi.fn(),
      listArtistWatchlist: vi.fn(),
      addArtistWatchlist: vi.fn(),
      removeArtistWatchlist: vi.fn(),
      listSavedSearches: vi.fn(),
      createSavedSearch: vi.fn(),
      removeSavedSearch: vi.fn(),
    },
    notificationsHttp: {
      listNotifications: vi.fn(),
      markManyRead: vi.fn(),
      archiveNotification: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
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
    securityHttp: {
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      revokeAllSessionsExceptCurrent: vi.fn(),
      notifyTwoFactorEnabled: vi.fn(),
      notifyTwoFactorDisabled: vi.fn(),
      requestAccountDeletion: vi.fn(),
    },
    ...overrides,
  };
}
