import { LOT_LIFECYCLE_QUEUE_NAME, QUEUE_REGISTRY, attachDlq } from "@auction/queues";
import { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { registerWorkerLotLifecycleConsumer } from "./register-lot-lifecycle-worker.js";

const redisUrl = process.env.REDIS_URL;
const integrationTimeoutMs = 25_000;

describe("registerWorkerLotLifecycleConsumer (integration)", () => {
  it.skipIf(!redisUrl)(
    "processes activate/end jobs via BullMQ",
    async () => {
      const url = redisUrl;
      if (!url) return;
      const redis = new Redis(url, { maxRetriesPerRequest: null });
      const processActivateJob = vi.fn().mockResolvedValue(undefined);
      const processEndJob = vi.fn().mockResolvedValue(undefined);
      const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

      const consumer = registerWorkerLotLifecycleConsumer({
        connection: redis,
        executor: {
          lotLifecycleService: { processActivateJob, processEndJob },
          saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
        } as never,
        log: log as never,
        onError: (err) => {
          throw err;
        },
      });

      const lotId = `lot-${Date.now()}`;
      await consumer.queue.add("activate", { lotId }, { jobId: `activate-${lotId}` });
      await consumer.queue.add("end", { lotId }, { jobId: `end-${lotId}`, delay: 50 });

      await vi.waitFor(
        () => {
          expect(processActivateJob).toHaveBeenCalledWith(lotId);
          expect(processEndJob).toHaveBeenCalledWith(lotId);
        },
        { timeout: 15_000 },
      );

      await consumer.close();
      await redis.quit();
      expect(LOT_LIFECYCLE_QUEUE_NAME).toBe("lot-lifecycle");
    },
    integrationTimeoutMs,
  );

  it.skipIf(!redisUrl)(
    "retries failed end jobs until success",
    async () => {
      const url = redisUrl;
      if (!url) return;
      const redis = new Redis(url, { maxRetriesPerRequest: null });
      let endAttempts = 0;
      const processEndJob = vi.fn().mockImplementation(async () => {
        endAttempts += 1;
        if (endAttempts < 2) throw new Error("transient_end_failure");
      });
      const consumer = registerWorkerLotLifecycleConsumer({
        connection: redis,
        executor: {
          lotLifecycleService: {
            processActivateJob: vi.fn(),
            processEndJob,
          },
          saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
        } as never,
        log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
        onError: () => {},
      });

      const lotId = `lot-retry-${Date.now()}`;
      await consumer.queue.add(
        "end",
        { lotId },
        {
          jobId: `end-retry-${lotId}`,
          attempts: 3,
          backoff: { type: "fixed", delay: 100 },
        },
      );

      await vi.waitFor(() => expect(processEndJob).toHaveBeenCalledTimes(2), { timeout: 20_000 });
      await consumer.close();
      await redis.quit();
    },
    integrationTimeoutMs,
  );

  it.skipIf(!redisUrl)(
    "wires attachDlq for exhausted lifecycle jobs",
    async () => {
      const url = redisUrl;
      if (!url) return;
      const redis = new Redis(url, { maxRetriesPerRequest: null });
      const dlqAdd = vi.fn().mockResolvedValue(undefined);
      const insertValues = vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      });
      const db = { insert: vi.fn().mockReturnValue({ values: insertValues }) };

      const processEndJob = vi.fn().mockRejectedValue(new Error("permanent_end_failure"));
      const consumer = registerWorkerLotLifecycleConsumer({
        connection: redis,
        executor: {
          lotLifecycleService: {
            processActivateJob: vi.fn(),
            processEndJob,
          },
          saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
        } as never,
        log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
        onError: () => {},
      });

      attachDlq(
        consumer.worker,
        LOT_LIFECYCLE_QUEUE_NAME,
        QUEUE_REGISTRY[LOT_LIFECYCLE_QUEUE_NAME],
        {
          dlqQueue: { add: dlqAdd } as never,
          db: db as never,
          logError: vi.fn(),
        },
      );

      const lotId = `lot-dlq-${Date.now()}`;
      await consumer.queue.add(
        "end",
        { lotId },
        {
          jobId: `end-dlq-${lotId}`,
          attempts: 1,
        },
      );

      await vi.waitFor(
        () => {
          expect(dlqAdd).toHaveBeenCalled();
          expect(insertValues).toHaveBeenCalled();
        },
        { timeout: 20_000 },
      );

      await consumer.close();
      await redis.quit();
    },
    integrationTimeoutMs,
  );

  it.skipIf(!redisUrl)("closes gracefully when idle", async () => {
    const url = redisUrl;
    if (!url) return;
    const redis = new Redis(url, { maxRetriesPerRequest: null });
    const consumer = registerWorkerLotLifecycleConsumer({
      connection: redis,
      executor: {
        lotLifecycleService: {
          processActivateJob: vi.fn(),
          processEndJob: vi.fn(),
        },
        saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
      } as never,
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
      onError: () => {},
    });
    await expect(consumer.close()).resolves.toBeUndefined();
    await redis.quit();
  });
});
