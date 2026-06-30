import { LotLifecycleService } from "../services/lot-lifecycle.service.js";
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
    domainEventPublisher,
    lotLifecycleRecording,
    notificationService,
    notificationOutboxService,
  } = platform;

  const lotLifecycleHooks: LotLifecycleHooks = {
    onLotActivated: null,
  };
  const lotLifecycleService = new LotLifecycleService(
    repoFactory,
    watchlistRepo,
    cache,
    notificationDispatcher,
    notificationFactory,
    antiShillingGuard,
    domainEventPublisher,
    async (lotId) => {
      await lotLifecycleHooks.onLotActivated?.(lotId);
    },
    lotLifecycleRecording,
    notificationService,
    notificationOutboxService,
    saleroomSessionLookup,
    saleRepo,
  );

  const saleLifecycleService = new SaleLifecycleService(saleRepo, lotRepo);

  return {
    lotLifecycleHooks,
    lotLifecycleService,
    saleLifecycleService,
  };
}
