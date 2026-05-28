import type { createDb } from "@auction/db";
import { failedJobs } from "@auction/db/schema";
import { captureBackgroundError } from "@auction/observability";
import type { Queue, Worker } from "bullmq";
import { redactPayload, safeSerializePayload } from "./redaction.js";
import type { QueueName } from "./registry.js";
import type { QueueDefinition } from "./types.js";

export type DlqDeps = {
  dlqQueue: Queue;
  db: ReturnType<typeof createDb>;
  logError: (message: string, context: Record<string, unknown>) => void;
};

export function dlqJobId(queueName: QueueName, originalJobId: string): string {
  return `dlq:${queueName}:${originalJobId}`;
}

export function jobAttemptsExhausted(
  job: { attemptsMade: number; opts: { attempts?: number } },
  def: QueueDefinition,
): boolean {
  const maxAttempts = job.opts.attempts ?? def.defaultJobOptions.attempts;
  return job.attemptsMade >= maxAttempts;
}

function serializePayload(data: unknown): string | null {
  return safeSerializePayload(data);
}

export function attachDlq(
  worker: Worker,
  queueName: QueueName,
  def: QueueDefinition,
  deps: DlqDeps,
): void {
  if (!def.dlq) return;

  worker.on("failed", (job, err) => {
    void (async () => {
      if (!job) return;
      if (!jobAttemptsExhausted(job, def)) return;

      const originalJobId = job.id != null ? String(job.id) : "unknown";
      const auditId = dlqJobId(queueName, originalJobId);
      const redisJobId = `${auditId}:${Date.now()}`;
      const payloadJson = serializePayload(job.data);

      try {
        await deps.dlqQueue.add(
          `${queueName}:exhausted`,
          {
            originalQueue: queueName,
            originalJobId: job.id,
            originalName: job.name,
            originalData: redactPayload(job.data),
            failedAt: new Date().toISOString(),
            errorMessage: err.message,
            errorStack: err.stack,
            attempts: job.attemptsMade,
          },
          {
            jobId: redisJobId,
            removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
            removeOnFail: false,
          },
        );

        await deps.db
          .insert(failedJobs)
          .values({
            id: auditId,
            originalQueue: queueName,
            originalJobId: job.id != null ? String(job.id) : null,
            originalJobName: job.name,
            payloadJson,
            errorMessage: err.message,
            attempts: job.attemptsMade,
            failedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: failedJobs.id,
            set: {
              originalJobName: job.name,
              payloadJson,
              errorMessage: err.message,
              attempts: job.attemptsMade,
              failedAt: new Date(),
              replayedAt: null,
              replayedBy: null,
            },
          });

        captureBackgroundError(`dlq-${queueName}`, err, {
          extra: { jobId: job.id, dlqJobId: auditId },
        });
      } catch (dlqErr) {
        deps.logError("dlq_insert_failed", {
          err: dlqErr,
          dlqJobId: auditId,
          queue: queueName,
        });
        captureBackgroundError("dlq-insert", dlqErr as Error, { extra: { queue: queueName } });
      }
    })();
  });
}

export function registerDlqHandlers(
  workers: Array<{ name: QueueName; worker: Worker }>,
  getDef: (name: QueueName) => QueueDefinition,
  deps: DlqDeps,
): void {
  for (const { name, worker } of workers) {
    attachDlq(worker, name, getDef(name), deps);
  }
}
