import { type ConnectionOptions, type Job, Queue, Worker } from "bullmq";

export type AuctionJobData = { auctionId: string };

export class AuctionJobScheduler {
  readonly queue: Queue<AuctionJobData>;

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly onActivate: (auctionId: string) => Promise<void>,
    private readonly onEnd: (auctionId: string) => Promise<void>,
  ) {
    this.queue = new Queue<AuctionJobData>("auction-lifecycle", { connection });
  }

  createWorker(): Worker<AuctionJobData> {
    return new Worker<AuctionJobData>(
      "auction-lifecycle",
      async (job: Job<AuctionJobData>) => {
        const id = job.data.auctionId;
        if (job.name === "activate") await this.onActivate(id);
        if (job.name === "end") await this.onEnd(id);
      },
      { connection: this.connection },
    );
  }

  async scheduleAuction(auctionId: string, startTime: Date, endTime: Date): Promise<void> {
    const now = Date.now();
    const activateDelay = Math.max(0, startTime.getTime() - now);
    const endDelay = Math.max(0, endTime.getTime() - now);
    await this.queue.add(
      "activate",
      { auctionId },
      {
        delay: activateDelay,
        jobId: `activate:${auctionId}`,
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
    await this.queue.add(
      "end",
      { auctionId },
      {
        delay: endDelay,
        jobId: `end:${auctionId}`,
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  }

  async rescheduleEnd(auctionId: string, endTime: Date): Promise<void> {
    const existing = await this.queue.getJob(`end:${auctionId}`);
    if (existing) await existing.remove();
    const delay = Math.max(0, endTime.getTime() - Date.now());
    await this.queue.add(
      "end",
      { auctionId },
      {
        delay,
        jobId: `end:${auctionId}`,
        removeOnComplete: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );
  }

  async cancelAuctionJobs(auctionId: string): Promise<void> {
    for (const jid of [`activate:${auctionId}`, `end:${auctionId}`]) {
      const j = await this.queue.getJob(jid);
      if (j) await j.remove();
    }
  }
}
