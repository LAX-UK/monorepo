import {
  ClerkLotOutcomeService,
  LotLifecycleNotificationCoordinator,
  LotLifecycleService,
  TimedLotTransitionRunner,
} from "../services/lot-lifecycle.service.js";
import { SaleLifecycleService } from "../services/sale-lifecycle.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

/** Mutable hook bag: `onLotActivated` is assigned later (bidding phase) so that
 * lot activation can replay scheduled absentee bids without a construction cycle. */
export type LotLifecycleHooks = { onLotActivated: ((lotId: string) => Promise<void>) | null };

export type ContainerLotLifecycle = {
  lotLifecycleHooks: LotLifecycleHooks;
  lotLifecycleService: LotLifecycleService;
  saleLifecycleService: SaleLifecycleService;
};

export type CreateLotLifecycleInput = {
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
};

export function createLotLifecycle(input: CreateLotLifecycleInput): ContainerLotLifecycle {
  const { infra, repos, platform } = input;
  const { cache } = infra;
  const {
    repoFactory,
    watchlistRepo,
    antiShillingGuard,
    saleroomSessionLookup,
    saleRepo,
    lotRepo,
  } = repos;
  const {
    notificationDispatcher,
    notificationFactory,
    domainEventSink,
    lotLifecycleRecording,
    notificationService,
    notificationOutboxService,
  } = platform;

  const lotLifecycleHooks: LotLifecycleHooks = {
    onLotActivated: null,
  };

  const lotLifecycleNotifications = new LotLifecycleNotificationCoordinator(
    repoFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
    notificationService,
    notificationOutboxService,
    saleRepo,
  );

  const clerkLotOutcomeService = new ClerkLotOutcomeService(
    repoFactory,
    lotLifecycleNotifications,
    antiShillingGuard,
    domainEventSink,
    lotLifecycleRecording,
  );

  const timedLotTransitionRunner = new TimedLotTransitionRunner(
    repoFactory,
    lotLifecycleNotifications,
    clerkLotOutcomeService,
    saleroomSessionLookup,
    lotLifecycleRecording,
    async (lotId) => {
      await lotLifecycleHooks.onLotActivated?.(lotId);
    },
  );

  const lotLifecycleService = new LotLifecycleService(
    clerkLotOutcomeService,
    timedLotTransitionRunner,
  );

  const saleLifecycleService = new SaleLifecycleService(saleRepo, lotRepo);

  return {
    lotLifecycleHooks,
    lotLifecycleService,
    saleLifecycleService,
  };
}
