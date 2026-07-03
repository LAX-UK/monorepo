import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { vi } from "vitest";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IAntiShillingGuard } from "../interfaces/anti-shilling.js";
import type { ICacheProvider } from "../interfaces/cache.js";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import type { ILotNotificationSender } from "../interfaces/notifications.js";
import type { ISaleRepository } from "../interfaces/repositories.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { ISaleroomSessionLookup } from "../interfaces/saleroom-session-lookup.js";
import type { IWatchlistRepository } from "../interfaces/watchlist.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import {
  ClerkLotOutcomeService,
  LotLifecycleNotificationCoordinator,
  LotLifecycleService,
  TimedLotTransitionRunner,
} from "../lot-lifecycle.service.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import { NotificationFactory } from "../notification.factory.js";

export type LotLifecycleTestDeps = {
  repos: IRepositoryFactory;
  watchlist?: IWatchlistRepository | null;
  cache?: ICacheProvider | null;
  notificationDispatcher?: NotificationDispatcher | null;
  notificationFactory?: NotificationFactory;
  antiShillingGuard?: IAntiShillingGuard | null;
  domainEventPublisher?: DomainEventPublisher | null;
  onLotActivated?: ((lotId: string) => Promise<void>) | null;
  lotLifecycleRecording?: LotLifecycleRecording | null;
  lotNotifications?: ILotNotificationSender | null;
  notificationOutbox?: INotificationOutboxService | null;
  saleroomSessionLookup?: ISaleroomSessionLookup | null;
  saleRepo?: ISaleRepository | null;
};

export function createLotLifecycleTestStack(deps: LotLifecycleTestDeps): LotLifecycleService {
  const notificationFactory = deps.notificationFactory ?? new NotificationFactory();
  const notifications = new LotLifecycleNotificationCoordinator(
    deps.repos,
    deps.watchlist ?? null,
    deps.cache ?? null,
    deps.notificationDispatcher ?? null,
    notificationFactory,
    deps.lotNotifications ?? null,
    deps.notificationOutbox ?? null,
    deps.saleRepo ?? null,
  );
  const clerkOutcomes = new ClerkLotOutcomeService(
    deps.repos,
    notifications,
    deps.antiShillingGuard ?? null,
    deps.domainEventPublisher ?? null,
    deps.lotLifecycleRecording ?? null,
  );
  const timedRunner = new TimedLotTransitionRunner(
    deps.repos,
    notifications,
    clerkOutcomes,
    deps.saleroomSessionLookup ?? null,
    deps.lotLifecycleRecording ?? null,
    deps.onLotActivated ?? null,
  );
  return new LotLifecycleService(clerkOutcomes, timedRunner);
}

export function bid(overrides: Partial<Bid> = {}): Bid {
  const now = new Date();
  const bidderId = overrides.bidderId ?? overrides.placedByUserId ?? "u1";
  return {
    id: "b1",
    lotId: "a1",
    bidderId,
    placedByUserId: bidderId,
    buyerLegalEntityId: overrides.buyerLegalEntityId ?? `${bidderId}-entity`,
    amount: "500.00",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: now,
    ...overrides,
  };
}

export function baseLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "a1",
    saleId: null,
    lotNumber: null,
    sellerId: "s1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1000001-0000-4000-8000-000000000001",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: "1000.00",
    buyNowPrice: null,
    currentPrice: "500.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    sellerLegalEntityId: "se-1",
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

export function createFactory(
  lots: import("../interfaces/repositories.js").ILotRepository,
  bids: Partial<import("../interfaces/repositories.js").IBidRepository>,
): IRepositoryFactory {
  const bidRepo = {
    clearWinningBid: vi.fn(),
    ...bids,
  } as unknown as import("../interfaces/repositories.js").IBidRepository;
  const root = { lot: lots, bid: bidRepo };
  return {
    root,
    forConnection: () => root,
    forTransaction: () => ({ ...root, sale: {} as never, itemSubmission: {} as never }),
    runInTransaction: async <T>(fn: (r: typeof root, tx: Database) => Promise<T>) =>
      fn(root, {} as unknown as Database),
  };
}

export function createTimedRunnerStack(deps: LotLifecycleTestDeps) {
  const notificationFactory = deps.notificationFactory ?? new NotificationFactory();
  const notifications = new LotLifecycleNotificationCoordinator(
    deps.repos,
    deps.watchlist ?? null,
    deps.cache ?? null,
    deps.notificationDispatcher ?? null,
    notificationFactory,
    deps.lotNotifications ?? null,
    deps.notificationOutbox ?? null,
    deps.saleRepo ?? null,
  );
  const clerkOutcomes = new ClerkLotOutcomeService(
    deps.repos,
    notifications,
    deps.antiShillingGuard ?? null,
    deps.domainEventPublisher ?? null,
    deps.lotLifecycleRecording ?? null,
  );
  const timedRunner = new TimedLotTransitionRunner(
    deps.repos,
    notifications,
    clerkOutcomes,
    deps.saleroomSessionLookup ?? null,
    deps.lotLifecycleRecording ?? null,
    deps.onLotActivated ?? null,
  );
  return { timedRunner, clerkOutcomes, notifications };
}

export function createClerkOutcomeStack(deps: LotLifecycleTestDeps) {
  const notificationFactory = deps.notificationFactory ?? new NotificationFactory();
  const notifications = new LotLifecycleNotificationCoordinator(
    deps.repos,
    deps.watchlist ?? null,
    deps.cache ?? null,
    deps.notificationDispatcher ?? null,
    notificationFactory,
    deps.lotNotifications ?? null,
    deps.notificationOutbox ?? null,
    deps.saleRepo ?? null,
  );
  const clerkOutcomes = new ClerkLotOutcomeService(
    deps.repos,
    notifications,
    deps.antiShillingGuard ?? null,
    deps.domainEventPublisher ?? null,
    deps.lotLifecycleRecording ?? null,
  );
  return { clerkOutcomes, notifications };
}

export function createNotificationCoordinatorStack(deps: LotLifecycleTestDeps) {
  const notificationFactory = deps.notificationFactory ?? new NotificationFactory();
  const notifications = new LotLifecycleNotificationCoordinator(
    deps.repos,
    deps.watchlist ?? null,
    deps.cache ?? null,
    deps.notificationDispatcher ?? null,
    notificationFactory,
    deps.lotNotifications ?? null,
    deps.notificationOutbox ?? null,
    deps.saleRepo ?? null,
  );
  return notifications;
}
