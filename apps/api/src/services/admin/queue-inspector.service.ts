import {
  DEAD_LETTER_QUEUE_NAME,
  type QueueName,
  createBullQueueOptions,
  heartbeatRedisKey,
  isQueueName,
  listEnabledQueues,
  redactPayload,
  truncatePayloadJson,
} from "@auction/queues";
import type { QueueRuntimeEnv } from "@auction/queues";
import { type ConnectionOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type {
  IQueueInspector,
  JobDetail,
  JobSummary,
  QueueJobStatus,
  QueueOverview,
} from "../interfaces/queue-inspector.js";

const COUNT_CACHE_TTL_SEC = 5;
const DLQ_SCAN_LIMIT = 499;

async function countDlqJobsForSource(dlq: Queue, sourceQueue: string): Promise<number> {
  const statuses = ["waiting", "delayed", "active"] as const;
  const batches = await Promise.all(
    statuses.map((status) => dlq.getJobs([status], 0, DLQ_SCAN_LIMIT)),
  );
  return batches
    .flat()
    .filter((job) => (job.data as { originalQueue?: string }).originalQueue === sourceQueue).length;
}

function mapJobSummary(job: {
  id?: string;
  name: string;
  attemptsMade: number;
  timestamp: number;
  failedReason?: string;
  data: unknown;
}): JobSummary {
  const redacted = redactPayload(job.data);
  const summary: JobSummary = {
    id: String(job.id),
    name: job.name,
    status: "waiting",
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    payloadPreview: truncatePayloadJson(redacted, 512),
  };
  if (job.failedReason !== undefined) {
    summary.failedReason = job.failedReason;
  }
  return summary;
}

export class BullMQQueueInspector implements IQueueInspector {
  private readonly queueCache = new Map<string, Queue>();

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly redis: Redis,
    private readonly runtimeEnv: QueueRuntimeEnv,
  ) {}

  private getQueue(name: QueueName): Queue {
    const cached = this.queueCache.get(name);
    if (cached) return cached;
    const queue = new Queue(name, createBullQueueOptions(name, { connection: this.connection }));
    this.queueCache.set(name, queue);
    return queue;
  }

  async list(): Promise<QueueOverview[]> {
    const enabled = listEnabledQueues(this.runtimeEnv);
    const dlq = this.getQueue(DEAD_LETTER_QUEUE_NAME);

    return Promise.all(
      enabled.map(async ({ name, def }) => {
        const cacheKey = `admin:queues:counts:${name}`;
        const cached = await this.redis.get(cacheKey);
        let counts: Record<string, number> | undefined;
        if (cached) {
          try {
            counts = JSON.parse(cached) as Record<string, number>;
          } catch {
            counts = undefined;
          }
        }
        if (!counts) {
          const queue = this.getQueue(name);
          counts = await queue.getJobCounts(
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
          );
          await this.redis.set(cacheKey, JSON.stringify(counts), "EX", COUNT_CACHE_TTL_SEC);
        }

        const hbKey = heartbeatRedisKey(name);
        let heartbeatAgeMs: number | null = null;
        if (hbKey) {
          const raw = await this.redis.get(hbKey);
          if (raw) {
            const ts = Number.parseInt(raw, 10);
            if (Number.isFinite(ts)) heartbeatAgeMs = Date.now() - ts;
          }
        }

        const queue = this.getQueue(name);
        const paused = await queue.isPaused();
        const dlqDepth = def.dlq ? await countDlqJobsForSource(dlq, name) : null;

        return {
          name,
          description: def.description,
          criticality: def.criticality,
          paused,
          counts,
          heartbeatAgeMs,
          dlqDepth,
        };
      }),
    );
  }

  async jobs(
    queueName: string,
    status: QueueJobStatus,
    page: { offset: number; limit: number },
  ): Promise<{ jobs: JobSummary[]; total: number }> {
    if (!isQueueName(queueName)) {
      throw new Error("unknown_queue");
    }
    const queue = this.getQueue(queueName);
    const end = page.offset + page.limit - 1;
    const jobs = await queue.getJobs([status], page.offset, end);
    const counts = await queue.getJobCounts(status);
    const total = counts[status] ?? jobs.length;
    return {
      jobs: jobs.map((job) => ({
        ...mapJobSummary(job),
        status,
      })),
      total,
    };
  }

  async job(queueName: string, jobId: string): Promise<JobDetail | null> {
    if (!isQueueName(queueName)) {
      throw new Error("unknown_queue");
    }
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = (await job.getState()) as QueueJobStatus;
    const redacted = redactPayload(job.data);
    return {
      ...mapJobSummary(job),
      status: state,
      payload: redacted,
      stacktrace: job.stacktrace ?? [],
      opts: (job.opts ?? {}) as Record<string, unknown>,
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.queueCache.values()].map((queue) => queue.close()));
    this.queueCache.clear();
  }
}
