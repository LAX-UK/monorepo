import type { LotJobSchedulerPort } from "@auction/bidding-runtime";
import { LOT_LIFECYCLE_QUEUE_NAME, createBullQueueOptions } from "@auction/queues";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export type LotJobData = { lotId: string };

function lotLifecycleJobId(kind: "activate" | "end", lotId: string): string {
  return `${kind}-${lotId}`;
}

/** Producer-only BullMQ adapter for anti-snipe reschedule (worker lifecycle consumer executes jobs). */
export class WorkerLotJobScheduler implements LotJobSchedulerPort {
  private readonly queue: Queue<LotJobData>;

  constructor(connection: Redis) {
    this.queue = new Queue<LotJobData>(
      LOT_LIFECYCLE_QUEUE_NAME,
      createBullQueueOptions(LOT_LIFECYCLE_QUEUE_NAME, { connection }),
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
