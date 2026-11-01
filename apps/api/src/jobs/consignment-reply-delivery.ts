import { CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME, createBullQueueOptions } from "@auction/queues";
import { type ConnectionOptions, type Job, Queue, Worker } from "bullmq";
import type { IConsignmentReplyDelivery } from "../services/consignment-messages/consignment-message.ports.js";

export type ConsignmentReplyJobData = { messageId: string };

/**
 * The job runs a little after the hold ends, so a clock a moment behind on another machine never
 * finds the reply still held.
 */
export const REPLY_DELIVERY_MARGIN_MS = 500;
/** A request waits this long for the queue before the reply is sent at once instead. */
export const REPLY_SCHEDULE_TIMEOUT_MS = 2_000;

/** BullMQ custom job ids must not contain `:`. */
export function replyDeliveryJobId(messageId: string): string {
  return `reply-${messageId}`;
}

function withinTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("reply delivery queue timed out")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Tells the account about a specialist's reply after its hold, as a delayed job. If the queue is
 * away `schedule` rejects within a couple of seconds, and the caller releases the reply at once.
 */
export class ConsignmentReplyDeliveryQueue implements IConsignmentReplyDelivery {
  readonly queue: Queue<ConsignmentReplyJobData>;

  constructor(private readonly connection: ConnectionOptions) {
    this.queue = new Queue<ConsignmentReplyJobData>(
      CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME,
      createBullQueueOptions(CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME, { connection }),
    );
  }

  createWorker(deliver: (messageId: string) => Promise<void>): Worker<ConsignmentReplyJobData> {
    return new Worker<ConsignmentReplyJobData>(
      CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME,
      async (job: Job<ConsignmentReplyJobData>) => deliver(job.data.messageId),
      createBullQueueOptions(CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME, {
        connection: this.connection,
      }),
    );
  }

  async schedule(messageId: string, at: Date): Promise<void> {
    const delay = Math.max(0, at.getTime() - Date.now()) + REPLY_DELIVERY_MARGIN_MS;
    await withinTimeout(
      this.queue.add("deliver", { messageId }, { delay, jobId: replyDeliveryJobId(messageId) }),
      REPLY_SCHEDULE_TIMEOUT_MS,
    );
  }

  async cancel(messageId: string): Promise<void> {
    const job = await withinTimeout(
      this.queue.getJob(replyDeliveryJobId(messageId)),
      REPLY_SCHEDULE_TIMEOUT_MS,
    );
    if (job) await job.remove();
  }
}
