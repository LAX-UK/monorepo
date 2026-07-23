import { describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => {
  const { EventEmitter } = require("node:events");
  class MockWorker extends EventEmitter {
    async close(): Promise<void> {}
  }
  class MockQueue {
    async close(): Promise<void> {}
  }
  return { Queue: MockQueue, Worker: MockWorker };
});

import type { EventEmitter } from "node:events";
import { LOT_LIFECYCLE_QUEUE_NAME, QUEUE_REGISTRY, registerDlqHandlers } from "@auction/queues";
import type { Worker } from "bullmq";
import { registerWorkerLotLifecycleConsumer } from "../lifecycle/register-lot-lifecycle-worker.js";

describe("worker lot-lifecycle DLQ behavior", () => {
  it("registers attachDlq via registerDlqHandlers for lifecycle worker", async () => {
    const dlqAdd = vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    const db = { insert: vi.fn().mockReturnValue({ values: insertValues }) };

    const consumer = registerWorkerLotLifecycleConsumer({
      connection: {} as never,
      executor: {
        lotLifecycleService: {
          processActivateJob: vi.fn(),
          processEndJob: vi.fn().mockRejectedValue(new Error("fail")),
        },
        saleLifecycleService: { reconcileSaleStatuses: vi.fn() },
      } as never,
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
      onError: () => {},
    });

    registerDlqHandlers(consumer.dlqHandlers, (name) => QUEUE_REGISTRY[name], {
      dlqQueue: { add: dlqAdd } as never,
      db: db as never,
      logError: vi.fn(),
    });

    const worker = consumer.worker as unknown as Worker & EventEmitter;
    worker.emit(
      "failed",
      {
        id: "job-1",
        name: "end",
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { lotId: "lot-1" },
      },
      new Error("fail"),
    );

    await vi.waitFor(() => {
      expect(dlqAdd).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalled();
    });

    expect(LOT_LIFECYCLE_QUEUE_NAME).toBe("lot-lifecycle");
    await consumer.close();
  });
});
