import type { IFailedJobRepository } from "@auction/persistence/interfaces";
import {
  type AppEnv,
  DEAD_LETTER_QUEUE_NAME,
  QUEUE_REGISTRY,
  type QueueName,
  assertQueueMutationAllowed,
  createBullQueueOptions,
  isQueueName,
} from "@auction/queues";
import { type ConnectionOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { ActorContext, IQueueMutator } from "../interfaces/queue-inspector.js";
import type { IQueueAuditService } from "./queue-audit.service.js";

const MUTATION_RATE_LIMIT = 10;
const MUTATION_WINDOW_SEC = 60;

/** Stable BullMQ job id for DLQ replay (dedupes concurrent/partial retries). */
export function dlqReplayJobId(dlqJobId: string): string {
  return `replay-${dlqJobId.replaceAll(":", "-")}`;
}

export class BullMQQueueMutator implements IQueueMutator {
  private readonly queueCache = new Map<string, Queue>();

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly redis: Redis,
    private readonly failedJobs: IFailedJobRepository,
    private readonly audit: IQueueAuditService,
    private readonly appEnv: AppEnv,
  ) {}

  private getQueue(name: QueueName): Queue {
    const cached = this.queueCache.get(name);
    if (cached) return cached;
    const queue = new Queue(name, createBullQueueOptions(name, { connection: this.connection }));
    this.queueCache.set(name, queue);
    return queue;
  }

  private async assertRateLimit(actor: ActorContext): Promise<void> {
    const key = `admin:queue-mutation:${actor.userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, MUTATION_WINDOW_SEC);
    }
    if (count > MUTATION_RATE_LIMIT) {
      throw new Error("rate_limit_exceeded");
    }
  }

  async retry(queueName: string, jobId: string, actor: ActorContext): Promise<void> {
    if (!isQueueName(queueName)) throw new Error("unknown_queue");
    assertQueueMutationAllowed(queueName, "retry", this.appEnv);

    try {
      await this.assertRateLimit(actor);
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);
      if (!job) throw new Error("job_not_found");
      await job.retry();
      this.audit.log("retry", { actor, queue: queueName, jobId, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "retry_failed";
      this.audit.log("retry", {
        actor,
        queue: queueName,
        jobId,
        success: false,
        errorMessage: message,
      });
      throw err;
    }
  }

  async pause(queueName: string, actor: ActorContext): Promise<void> {
    if (!isQueueName(queueName)) throw new Error("unknown_queue");
    assertQueueMutationAllowed(queueName, "pause", this.appEnv);

    try {
      await this.assertRateLimit(actor);
      const queue = this.getQueue(queueName);
      await queue.pause();
      this.audit.log("pause", { actor, queue: queueName, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "pause_failed";
      this.audit.log("pause", { actor, queue: queueName, success: false, errorMessage: message });
      throw err;
    }
  }

  async resume(queueName: string, actor: ActorContext): Promise<void> {
    if (!isQueueName(queueName)) throw new Error("unknown_queue");
    assertQueueMutationAllowed(queueName, "resume", this.appEnv);

    try {
      await this.assertRateLimit(actor);
      const queue = this.getQueue(queueName);
      await queue.resume();
      this.audit.log("resume", { actor, queue: queueName, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "resume_failed";
      this.audit.log("resume", { actor, queue: queueName, success: false, errorMessage: message });
      throw err;
    }
  }

  async replayFromDlq(
    dlqJobId: string,
    actor: ActorContext,
    confirmIdempotency: boolean,
  ): Promise<void> {
    if (!confirmIdempotency) throw new Error("idempotency_confirmation_required");

    try {
      await this.assertRateLimit(actor);

      const auditRow = await this.failedJobs.findById(dlqJobId);

      if (!auditRow) throw new Error("dlq_job_not_found");
      if (auditRow.replayedAt) throw new Error("already_replayed");
      if (!auditRow.payloadJson) throw new Error("payload_not_available");

      const originalQueue = auditRow.originalQueue;
      if (!isQueueName(originalQueue)) throw new Error("invalid_original_queue");

      let payload: unknown;
      try {
        payload = JSON.parse(auditRow.payloadJson) as unknown;
      } catch {
        throw new Error("invalid_payload");
      }

      const claimed = await this.failedJobs.claimReplay(dlqJobId, actor.userId);

      if (!claimed) throw new Error("already_replayed");

      const target = this.getQueue(originalQueue);
      const replayJobId = dlqReplayJobId(dlqJobId);

      try {
        await target.add(auditRow.originalJobName ?? "replay", payload, {
          jobId: replayJobId,
          attempts: QUEUE_REGISTRY[originalQueue].defaultJobOptions.attempts,
          backoff: QUEUE_REGISTRY[originalQueue].defaultJobOptions.backoff,
        });

        const dlq = this.getQueue(DEAD_LETTER_QUEUE_NAME);
        const dlqPrefix = `${dlqJobId}:`;
        const dlqJobs = await dlq.getJobs(["waiting", "delayed", "active"], 0, 499);
        await Promise.all(
          dlqJobs
            .filter((job) => {
              const id = String(job.id);
              return id === dlqJobId || id.startsWith(dlqPrefix);
            })
            .map((job) => job.remove()),
        );
      } catch (enqueueErr) {
        await this.failedJobs.clearReplayClaim(dlqJobId);
        throw enqueueErr;
      }

      this.audit.log("replay_dlq", {
        actor,
        queue: originalQueue,
        jobId: dlqJobId,
        success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "replay_failed";
      this.audit.log("replay_dlq", {
        actor,
        jobId: dlqJobId,
        success: false,
        errorMessage: message,
      });
      throw err;
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.queueCache.values()].map((queue) => queue.close()));
    this.queueCache.clear();
  }
}
