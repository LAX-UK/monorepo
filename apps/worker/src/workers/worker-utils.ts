import { captureBackgroundError } from "@auction/observability";
import type { Logger } from "pino";
import type { WorkerErrorHandlerEntry } from "./types.js";

export function createReportWorkerJobFailure(log: Logger) {
  return function reportWorkerJobFailure(
    queue: string,
    job: { id?: string } | undefined,
    err: Error,
  ): void {
    log.warn({ jobId: job?.id, err, queue }, "worker job failed");
    captureBackgroundError(`worker-${queue}`, err, { extra: { jobId: job?.id } });
  };
}

export function registerWorkerErrorHandlers(workers: WorkerErrorHandlerEntry[], log: Logger): void {
  for (const { worker, queue } of workers) {
    worker.on("error", (err: Error) => {
      log.error({ err, queue }, "bullmq worker error");
    });
  }
}

export async function closeAll(closables: Array<{ close: () => Promise<void> }>): Promise<void> {
  await Promise.allSettled(closables.map((c) => c.close()));
}
