import {
  ConsoleEmailService,
  type IEmailService,
  PostmarkEmailService,
  bindEmailQueue,
} from "@auction/email";
import { EMAIL_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import {
  ConsoleEmailSender,
  PostmarkEmailSender,
} from "../infrastructure/postmark-email.sender.js";
import {
  type SendEmailJobData,
  enqueueStaleEmailOutboxRows,
  sendEmailJob,
} from "../jobs/send-email.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
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
    bullConnection,
    queueOpts,
    log,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  } = deps;

  const emailSender =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailSender({
          serverToken: env.POSTMARK_SERVER_TOKEN ?? "",
          from: env.EMAIL_FROM,
          replyTo: env.EMAIL_REPLY_TO,
          transactionalStream: env.POSTMARK_TRANSACTIONAL_STREAM,
          broadcastStream: env.POSTMARK_BROADCAST_STREAM,
        })
      : new ConsoleEmailSender();

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
          const count = await enqueueStaleEmailOutboxRows({ db, queue: emailQueue });
          log.info({ count }, "email outbox drain completed");
          await heartbeat("email");
        });
        return;
      }
      await sendEmailJob({ db, sender: emailSender, log }, job.data as SendEmailJobData);
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
