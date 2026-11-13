import {
  ConsoleEmailService,
  type IEmailService,
  PostmarkEmailService,
  bindEmailQueue,
} from "@auction/email";
import {
  EMAIL_QUEUE_NAME,
  REACTIVATE_EMAIL_ADDRESS_JOB_NAME,
  type ReactivateEmailAddressJobData,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import {
  ConsoleEmailSender,
  PostmarkEmailSender,
} from "../infrastructure/postmark-email.sender.js";
import { PostmarkSuppressionAdapter } from "../infrastructure/postmark-suppression.adapter.js";
import {
  type SendEmailJobData,
  enqueueStaleEmailOutboxRows,
  sendEmailJob,
} from "../jobs/send-email.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import { reactivateEmailAddressUseCase } from "../services/reactivate-email-address.use-case.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

type EmailQueueJobData = SendEmailJobData | Record<string, never>;

export type EmailWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  emailOutboxService: IEmailService;
  close: () => Promise<void>;
};

export function registerEmailWorker(deps: WorkerBootstrapDeps): EmailWorkersHandle {
  const {
    env,
    db,
    emailOutboxRepo,
    emailAddressLookup,
    bullConnection,
    queueOpts,
    log,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
    uploadStorage,
  } = deps;

  const emailSender =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailSender({
          serverToken: env.POSTMARK_SERVER_TOKEN ?? "",
          from: env.EMAIL_FROM,
          fromByProduct: env.EMAIL_FROM_BY_PRODUCT,
          replyTo: env.EMAIL_REPLY_TO,
          transactionalStream: env.POSTMARK_TRANSACTIONAL_STREAM,
          broadcastStream: env.POSTMARK_BROADCAST_STREAM,
          // A stored invoice copy is attached from document storage when the email is sent.
          storedFiles: uploadStorage,
        })
      : new ConsoleEmailSender();

  // Only Postmark keeps a block list of its own; the console provider has nothing to reactivate.
  const reactivation =
    env.EMAIL_PROVIDER === "postmark"
      ? {
          addresses: emailAddressLookup,
          provider: new PostmarkSuppressionAdapter(env.POSTMARK_SERVER_TOKEN ?? ""),
          streams: [env.POSTMARK_TRANSACTIONAL_STREAM, env.POSTMARK_BROADCAST_STREAM],
          log,
        }
      : null;

  const emailQueue = new Queue<EmailQueueJobData>(EMAIL_QUEUE_NAME, queueOpts(EMAIL_QUEUE_NAME));

  const emailOutboxService: IEmailService =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailService(db, bindEmailQueue(emailQueue as Queue<{ outboxId: string }>))
      : new ConsoleEmailService(db, bindEmailQueue(emailQueue as Queue<{ outboxId: string }>));

  const emailWorker = new Worker<EmailQueueJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      if (job.name === "outbox-drain") {
        await withSentryCronMonitor("email-outbox-drain", sentryMonitorSlugs, async () => {
          const count = await enqueueStaleEmailOutboxRows({
            outboxRepo: emailOutboxRepo,
            queue: emailQueue,
          });
          log.info({ count }, "email outbox drain completed");
          await heartbeat("email");
        });
        return;
      }
      if (job.name === REACTIVATE_EMAIL_ADDRESS_JOB_NAME) {
        if (reactivation) {
          await reactivateEmailAddressUseCase(
            reactivation,
            job.data as unknown as ReactivateEmailAddressJobData,
          );
        }
        return;
      }
      await sendEmailJob(
        { outboxRepo: emailOutboxRepo, sender: emailSender, log },
        job.data as SendEmailJobData,
      );
      await heartbeat("email");
    },
    {
      ...bullConnection,
      concurrency: 10,
      limiter: { max: 50, duration: 1000 },
    },
  );
  emailWorker.on("completed", () => void heartbeat("email"));
  emailWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("email", job, err);
  });
  void emailQueue.add(
    "outbox-drain",
    {},
    { jobId: "email-outbox-drain", repeat: { every: 60_000 }, removeOnComplete: 100 },
  );

  return {
    errorHandlers: [{ worker: emailWorker, queue: EMAIL_QUEUE_NAME }],
    dlqHandlers: [{ name: EMAIL_QUEUE_NAME, worker: emailWorker }],
    emailOutboxService,
    close: () => closeAll([emailWorker, emailQueue]),
  };
}
