import {
  AbsenteeBidService,
  DEFAULT_BID_POLICY,
  type IBidPlacer,
  type INotificationOutboxService,
  LotStrategyFactory,
  NotificationFactory,
  SaleroomOnBlockPolicy,
  createBidPlacer,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import {
  DrizzleAbsenteeBidRepository,
  DrizzleAntiShillingRepository,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleSaleModeLookup,
  DrizzleSaleRepository,
  DrizzleSaleroomOnBlockReader,
  DrizzleSaleroomSessionLookup,
} from "@auction/persistence/repositories";
import type { Redis } from "ioredis";
import type { WorkerEnv } from "../env.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { WorkerLotLifecycleEventRecorder } from "../lifecycle/worker-lifecycle-event-recorder.js";
import {
  createWorkerBidEligibility,
  createWorkerBidIdentityEligibilityGate,
} from "./create-worker-bid-eligibility.js";
import { WorkerBidLotLifecycleRecording } from "./worker-bid-lot-lifecycle-recording.js";
import {
  WorkerRedisBidNotificationSender,
  WorkerRedisCacheProvider,
  WorkerRedisIdempotencyStore,
} from "./worker-bidding-infra.js";
import { WorkerLotJobScheduler } from "./worker-lot-job-scheduler.js";

export type WorkerBiddingComposition = {
  ready: boolean;
  absenteeReplay: { replayScheduledForLot(lotId: string): Promise<void> } | null;
};

export type CreateWorkerBiddingCompositionInput = {
  env: WorkerEnv;
  db: Database;
  redis: Redis;
  repoFactory: IRepositoryFactory;
  domainEventSink: IWorkerDomainEventSink;
};

function toRuntimeBidPlacer(bidPlacer: ReturnType<typeof createBidPlacer>): IBidPlacer {
  return bidPlacer;
}

export function createWorkerBiddingComposition(
  input: CreateWorkerBiddingCompositionInput,
): WorkerBiddingComposition {
  const { db, redis, repoFactory, domainEventSink, env } = input;

  const lotJobs = new WorkerLotJobScheduler(redis);
  const cache = new WorkerRedisCacheProvider(redis);
  const notifications = new WorkerRedisBidNotificationSender(redis);
  const idempotencyStore = new WorkerRedisIdempotencyStore(redis);
  const notificationFactory = new NotificationFactory();
  const outboxRepo = new DrizzleNotificationOutboxRepository(db);
  const notificationOutbox: INotificationOutboxService = {
    stageDispatch: async (stageInput, tx) => {
      await outboxRepo.stage(stageInput, tx);
    },
  };

  const legalEntities = new DrizzleLegalEntityRepository(
    new DrizzleLegalEntityReader(db),
    new DrizzleLegalEntityMembershipReader(db),
  );

  const identityEligibilityGate = createWorkerBidIdentityEligibilityGate(db, env);
  const bidEligibility = createWorkerBidEligibility({ db, env, identityEligibilityGate });
  const lotLifecycleJournal = new WorkerLotLifecycleEventRecorder(
    domainEventSink,
    new DrizzleLotLifecycleSnapshotRepository(db),
  );
  const lotLifecycleRecording = new WorkerBidLotLifecycleRecording(lotLifecycleJournal);

  const bidPlacer = createBidPlacer({
    repos: repoFactory,
    strategyFactory: new LotStrategyFactory(),
    cache,
    notifications,
    lotJobs,
    saleModeLookup: new DrizzleSaleModeLookup(db),
    saleroomSessionLookup: new DrizzleSaleroomSessionLookup(db),
    saleroomOnBlockPolicy: new SaleroomOnBlockPolicy(new DrizzleSaleroomOnBlockReader(db)),
    antiShillingGuard: new DrizzleAntiShillingRepository(db),
    domainEventSink,
    legalEntityRepository: legalEntities,
    idempotencyStore,
    bidEligibility,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    lotLifecycleRecording,
    bidPolicy: DEFAULT_BID_POLICY,
    notificationOutbox,
    notificationFactory,
    saleRepo: new DrizzleSaleRepository(db),
  });

  const absenteeReplay = new AbsenteeBidService(
    new DrizzleAbsenteeBidRepository(db),
    toRuntimeBidPlacer(bidPlacer),
    repoFactory.root.lot,
    legalEntities,
    repoFactory.root.bid,
    identityEligibilityGate,
  );

  return {
    ready: true,
    absenteeReplay: {
      replayScheduledForLot: (lotId) => absenteeReplay.replayScheduledForLot(lotId),
    },
  };
}
