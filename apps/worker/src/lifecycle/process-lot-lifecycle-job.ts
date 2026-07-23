import type { WorkerLifecycleExecutor } from "./worker-lifecycle-executor.js";

export type LotLifecycleJobData = { lotId: string };

export async function processLotLifecycleJob(input: {
  jobName: string;
  lotId: string;
  executor: WorkerLifecycleExecutor;
}): Promise<void> {
  if (input.jobName === "activate") {
    await input.executor.lotLifecycleService.processActivateJob(input.lotId);
    return;
  }
  if (input.jobName === "end") {
    await input.executor.lotLifecycleService.processEndJob(input.lotId);
    return;
  }
  throw new Error(`unknown_lot_lifecycle_job:${input.jobName}`);
}
