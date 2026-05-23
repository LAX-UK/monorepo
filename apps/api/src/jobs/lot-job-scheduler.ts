import { type ConnectionOptions, type Job, Queue, Worker } from "bullmq";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";

export type LotJobData = { lotId: string };

/** BullMQ custom job ids must not contain `:`. */
function lotLifecycleJobId(kind: "activate" | "end", lotId: string): string {
  return `${kind}-${lotId}`;
}

export class LotJobScheduler implements ILotJobScheduler {
  readonly queue: Queue<LotJobData>;

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly onActivate: (lotId: string) => Promise<void>,
    private readonly onEnd: (lotId: string) => Promise<void>,
  ) {
    this.queue = new Queue<LotJobData>("lot-lifecycle", { connection });
  }

  createWorker(): Worker<LotJobData> {
    return new Worker<LotJobData>(
      "lot-lifecycle",
      async (job: Job<LotJobData>) => {
        const id = job.data.lotId;
        if (job.name === "activate") await this.onActivate(id);
        if (job.name === "end") await this.onEnd(id);
      },
      { connection: this.connection },
    );
  }

  async scheduleLot(lotId: string, startTime: Date, endTime: Date): Promise<void> {
    const now = Date.now();
    const activateDelay = Math.max(0, startTime.getTime() - now);
    const endDelay = Math.max(0, endTime.getTime() - now);
    await this.queue.add(
      "activate",
      { lotId },
      {
        delay: activateDelay,
        jobId: lotLifecycleJobId("activate", lotId),
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
    await this.queue.add(
      "end",
      { lotId },
      {
        delay: endDelay,
        jobId: lotLifecycleJobId("end", lotId),
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  }

  async rescheduleEnd(lotId: string, endTime: Date): Promise<void> {
    const existing = await this.queue.getJob(lotLifecycleJobId("end", lotId));
    if (existing) await existing.remove();
    const delay = Math.max(0, endTime.getTime() - Date.now());
    await this.queue.add(
      "end",
      { lotId },
      {
        delay,
        jobId: lotLifecycleJobId("end", lotId),
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  }

  async cancelLotJobs(lotId: string): Promise<void> {
    for (const jid of [lotLifecycleJobId("activate", lotId), lotLifecycleJobId("end", lotId)]) {
      const j = await this.queue.getJob(jid);
      if (j) await j.remove();
    }
  }
}
