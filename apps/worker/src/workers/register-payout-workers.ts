import { PAYOUT_SETTLEMENT_QUEUE_NAME, PAYOUT_STATEMENTS_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { runBulkPayoutSettlementJob } from "../jobs/bulk-payout-settlement.js";
import {
  type GeneratePayoutStatementJobData,
  generatePayoutStatementJob,
} from "../jobs/generate-payout-statement.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** BullMQ `repeat.pattern` uses cron-parser; Monday 09:00 UTC. */
const BULK_PAYOUT_SETTLEMENT_CRON_PATTERN = "0 9 * * 1";

function nextBulkPayoutSettlementRunUtc(from = new Date()): Date {
  const hourUtc = 9;
  const targetDow = 1; // Monday
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hourUtc, 0, 0, 0),
  );
  let addDays = (targetDow - candidate.getUTCDay() + 7) % 7;
  if (addDays === 0 && from.getTime() >= candidate.getTime()) {
    addDays = 7;
  }
  candidate.setUTCDate(candidate.getUTCDate() + addDays);
  return candidate;
}

type PayoutStatementJobData = GeneratePayoutStatementJobData;

export type PayoutWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  close: () => Promise<void>;
};

export function registerPayoutWorkers(deps: WorkerBootstrapDeps): PayoutWorkersHandle {
  const {
    env,
    log,
    bullConnection,
    queueOpts,
    uploadStorage,
    payoutStatementRepo,
    sentryMonitorSlugs,
    heartbeat,
  } = deps;

  const payoutStatementQueue = new Queue<PayoutStatementJobData>(
    PAYOUT_STATEMENTS_QUEUE_NAME,
    queueOpts(PAYOUT_STATEMENTS_QUEUE_NAME),
  );
  const payoutStatementWorker = new Worker<PayoutStatementJobData>(
    PAYOUT_STATEMENTS_QUEUE_NAME,
    async (job) => {
      await generatePayoutStatementJob({
        payoutStatementRepo,
        storage: uploadStorage,
        env,
        log,
        job,
      });
      await heartbeat("payout-statements");
    },
    {
      ...bullConnection,
      concurrency: 2,
      limiter: { max: 20, duration: 1000 },
    },
  );
  payoutStatementWorker.on("completed", () => void heartbeat("payout-statements"));

  let payoutSettlementQueue: Queue | undefined;
  let payoutSettlementWorker: Worker | undefined;
  if (env.CRON_INTERNAL_SECRET) {
    const cronSecret = env.CRON_INTERNAL_SECRET;
    payoutSettlementQueue = new Queue(
      PAYOUT_SETTLEMENT_QUEUE_NAME,
      queueOpts(PAYOUT_SETTLEMENT_QUEUE_NAME),
    );
    payoutSettlementWorker = new Worker(
      PAYOUT_SETTLEMENT_QUEUE_NAME,
      async () => {
        await withSentryCronMonitor("payout-settlement", sentryMonitorSlugs, async () => {
          await runBulkPayoutSettlementJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat("payout-settlement");
        });
      },
      bullConnection,
    );
    payoutSettlementWorker.on("completed", () => void heartbeat("payout-settlement"));
    void payoutSettlementQueue.add(
      "bulk-payout-settlement",
      {},
      {
        jobId: "weekly-bulk-payout-settlement-mon-0900-utc",
        repeat: { pattern: BULK_PAYOUT_SETTLEMENT_CRON_PATTERN, tz: "UTC" },
        removeOnComplete: 50,
      },
    );
    const nextAt = nextBulkPayoutSettlementRunUtc();
    log.info(
      {
        repeatPattern: BULK_PAYOUT_SETTLEMENT_CRON_PATTERN,
        tz: "UTC",
        nextRunAtUtc: nextAt.toISOString(),
      },
      `payout-settlement repeat registered; next run at [${nextAt.toISOString()}] (Monday 09:00 UTC)`,
    );
  }

  const errorHandlers: WorkerErrorHandlerEntry[] = [
    { worker: payoutStatementWorker, queue: PAYOUT_STATEMENTS_QUEUE_NAME },
    ...(payoutSettlementWorker
      ? [{ worker: payoutSettlementWorker, queue: PAYOUT_SETTLEMENT_QUEUE_NAME }]
      : []),
  ];

  const dlqHandlers: DlqHandlerEntry[] = [
    { name: PAYOUT_STATEMENTS_QUEUE_NAME, worker: payoutStatementWorker },
    ...(payoutSettlementWorker
      ? [{ name: PAYOUT_SETTLEMENT_QUEUE_NAME, worker: payoutSettlementWorker }]
      : []),
  ];

  const closables = [
    payoutStatementWorker,
    payoutStatementQueue,
    ...(payoutSettlementWorker ? [payoutSettlementWorker] : []),
    ...(payoutSettlementQueue ? [payoutSettlementQueue] : []),
  ];

  return {
    errorHandlers,
    dlqHandlers,
    close: () => closeAll(closables),
  };
}
