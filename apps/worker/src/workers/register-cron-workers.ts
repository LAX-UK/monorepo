import { STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { runStaleSubmissionDraftRemindersJob } from "../jobs/stale-submission-draft-reminders.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import { registerFinanceAndLifecycleCronWorkers } from "./register-finance-cron-workers.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type CronWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerCronWorkers(deps: WorkerBootstrapDeps): CronWorkersHandle {
  const { env, log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;

  const errorHandlers: WorkerErrorHandlerEntry[] = [];
  const closables: Array<{ close: () => Promise<void> }> = [];

  const cronSecret = env.CRON_INTERNAL_SECRET ?? "";

  if (env.LIFECYCLE_EXECUTION_OWNER === "worker") {
    const lifecyclePartial = registerFinanceAndLifecycleCronWorkers(deps, cronSecret, {
      lifecycleTickOnly: true,
    });
    errorHandlers.push(...lifecyclePartial.errorHandlers);
    closables.push(...lifecyclePartial.closables);
  }

  if (!env.CRON_INTERNAL_SECRET) {
    return {
      errorHandlers,
      close: () => closeAll(closables),
    };
  }

  const financePartial = registerFinanceAndLifecycleCronWorkers(deps, cronSecret, {
    skipLifecycleTick: env.LIFECYCLE_EXECUTION_OWNER === "worker",
  });
  errorHandlers.push(...financePartial.errorHandlers);
  closables.push(...financePartial.closables);

  const staleSubmissionDraftRemindersQueue = new Queue(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    bullConnection,
  );
  const staleSubmissionDraftRemindersWorker = new Worker(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
        sentryMonitorSlugs,
        async () => {
          await runStaleSubmissionDraftRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME);
        },
      );
    },
    bullConnection,
  );
  staleSubmissionDraftRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME, job, err);
  });
  void staleSubmissionDraftRemindersQueue.add(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    {},
    {
      jobId: "daily-stale-submission-draft-reminders",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("stale-submission-draft-reminders repeat registered (daily)");
  errorHandlers.push({
    worker: staleSubmissionDraftRemindersWorker,
    queue: STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
  });
  closables.push(staleSubmissionDraftRemindersWorker, staleSubmissionDraftRemindersQueue);

  return {
    errorHandlers,
    close: () => closeAll(closables),
  };
}
