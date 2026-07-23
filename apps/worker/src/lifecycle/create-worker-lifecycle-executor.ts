import type { Database } from "@auction/db";
import {
  ClerkLotOutcomeService,
  LotLifecycleService,
  SaleLifecycleService,
  TimedLotTransitionRunner,
} from "@auction/lot-lifecycle-app";
import type { ILifecycleDomainEventSink } from "@auction/lot-lifecycle-app";
import {
  DrizzleAntiShillingRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleRepositoryFactory,
  DrizzleSaleRepository,
  DrizzleSaleroomSessionLookup,
  DrizzleWatchlistRepository,
} from "@auction/persistence/repositories";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { WorkerRepositories } from "../container/create-worker-repositories.js";
import { WorkerLotLifecycleEventRecorder } from "./worker-lifecycle-event-recorder.js";
import { WorkerLifecycleTransitionRecorder } from "./worker-lifecycle-transition-recorder.js";
import { WorkerLotLifecycleNotifications } from "./worker-lot-lifecycle-notifications.js";

export type WorkerLifecycleExecutor = {
  lotLifecycleService: LotLifecycleService;
  saleLifecycleService: SaleLifecycleService;
};

export type CreateWorkerLifecycleExecutorInput = {
  db: Database;
  repos: WorkerRepositories;
  redis: Redis;
  log: pino.Logger;
  onLotActivated: ((lotId: string) => Promise<void>) | null;
};

export function createWorkerLifecycleExecutor(
  input: CreateWorkerLifecycleExecutorInput,
): WorkerLifecycleExecutor {
  const { db, repos, redis, onLotActivated } = input;
  const repoFactory = new DrizzleRepositoryFactory(db);
  const notifications = new WorkerLotLifecycleNotifications({
    repoFactory,
    watchlist: new DrizzleWatchlistRepository(db),
    redis,
    notificationOutbox: new DrizzleNotificationOutboxRepository(db),
    saleRepo: new DrizzleSaleRepository(db),
  });
  const antiShillingGuard = new DrizzleAntiShillingRepository(db);
  const saleroomSessionLookup = new DrizzleSaleroomSessionLookup(db);
  const domainSink = repos.domainEventSink as ILifecycleDomainEventSink;
  const journal = new WorkerLotLifecycleEventRecorder(
    repos.domainEventSink,
    new DrizzleLotLifecycleSnapshotRepository(db),
  );
  const recorder = new WorkerLifecycleTransitionRecorder(journal);
  const clerk = new ClerkLotOutcomeService(
    repoFactory,
    notifications,
    antiShillingGuard,
    domainSink,
    recorder,
  );
  const timed = new TimedLotTransitionRunner(
    repoFactory,
    notifications,
    clerk,
    saleroomSessionLookup,
    recorder,
    onLotActivated,
  );
  return {
    lotLifecycleService: new LotLifecycleService(clerk, timed),
    saleLifecycleService: new SaleLifecycleService(
      new DrizzleSaleRepository(db),
      repoFactory.root.lot,
    ),
  };
}
