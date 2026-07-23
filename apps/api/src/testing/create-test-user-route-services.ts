import { vi } from "vitest";
import {
  type CreateUserRouteServicesInput,
  createUserRouteServices,
} from "../container/create-user-route-services.js";
import type { UserRouteServices } from "../services/interfaces/user-routes/index.js";

export function createTestUserRouteServicesInput(
  overrides: Partial<CreateUserRouteServicesInput> = {},
): CreateUserRouteServicesInput {
  return {
    env: { WEB_ORIGIN: "https://test.lax.bid", DISABLE_NEW_USER_REGISTRATION: false },
    registrationService: { register: vi.fn() } as never,
    marketingEventService: { emit: vi.fn(), enqueue: vi.fn() } as never,
    userService: { listPublicArtists: vi.fn(), getById: vi.fn() } as never,
    mediaUrlResolver: { resolve: vi.fn(async (x: string | null) => x) } as never,
    conditionReportService: { listForBuyer: vi.fn() } as never,
    userDashboardReadService: {
      listBidsForUser: vi.fn(),
      listWatchlistForUser: vi.fn(),
    } as never,
    lotService: { list: vi.fn(), getById: vi.fn() } as never,
    paymentBuyerService: { listMyPaymentsForBuyerApi: vi.fn() } as never,
    mediaAssetEnricher: {} as never,
    saleService: { findByIds: vi.fn(async () => []) } as never,
    watchlistService: {
      listIds: vi.fn(),
      addWithMarketingEvent: vi.fn(),
      removeWithMarketingEvent: vi.fn(),
    } as never,
    artistWatchlistService: { list: vi.fn(), add: vi.fn(), remove: vi.fn() } as never,
    savedSearchService: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } as never,
    notificationQueryService: {
      listForUserFiltered: vi.fn(),
      markManyRead: vi.fn(),
      archive: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
    } as never,
    vapidPublicKey: null,
    pushSubscriptionRepository: {
      findByUser: vi.fn(async () => []),
      create: vi.fn(),
      deleteByEndpoint: vi.fn(),
    } as never,
    notificationPreferenceRepository: { getForUser: vi.fn(), upsert: vi.fn() } as never,
    uiPreferenceService: {
      getForUser: vi.fn(),
      patch: vi.fn(),
      resetLayoutDefaults: vi.fn(),
    } as never,
    profileService: { getProfile: vi.fn(), updateProfile: vi.fn() } as never,
    addressService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setDefault: vi.fn(),
    } as never,
    sessionRevocation: {
      listForUser: vi.fn(),
      deleteSessionForUser: vi.fn(),
      getSessionIdForCookieToken: vi.fn(),
      revokeAllForUserExcept: vi.fn(),
    } as never,
    authAuditPublisher: { publish: vi.fn(async () => {}) } as never,
    userSecurityReadService: { getTwoFactorEnabled: vi.fn() } as never,
    emailService: { enqueue: vi.fn() } as never,
    accountDeletionEligibilityService: { check: vi.fn() } as never,
    ...overrides,
  };
}

export function createTestUserRouteServices(
  overrides: Partial<CreateUserRouteServicesInput> = {},
): UserRouteServices {
  return createUserRouteServices(createTestUserRouteServicesInput(overrides));
}
