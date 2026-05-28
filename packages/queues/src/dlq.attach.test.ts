import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Worker } from "bullmq";
import { attachDlq } from "./dlq.js";
import { EMAIL_QUEUE_NAME, QUEUE_REGISTRY } from "./registry.js";

describe("attachDlq", () => {
  it("writes full payload to failed_jobs and redacted data to Redis", async () => {
    const worker = new EventEmitter() as Worker;
    const dlqAdd = vi.fn().mockResolvedValue(undefined);
    const dlqQueue = { add: dlqAdd };
    const insertValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };

    attachDlq(worker, EMAIL_QUEUE_NAME, QUEUE_REGISTRY[EMAIL_QUEUE_NAME], {
      dlqQueue: dlqQueue as never,
      db: db as never,
      logError: vi.fn(),
    });

    worker.emit("failed", {
      id: "job-42",
      name: "send",
      attemptsMade: 5,
      opts: {},
      data: { outboxId: "abc", email: "secret@example.com" },
    }, new Error("smtp down"));

    await vi.waitFor(() => {
      expect(dlqAdd).toHaveBeenCalledOnce();
      expect(insertValues).toHaveBeenCalledOnce();
    });

    const redisPayload = dlqAdd.mock.calls[0]?.[1] as { originalData: Record<string, unknown> };
    expect(redisPayload.originalData).toEqual({ outboxId: "abc", email: "[redacted]" });

    const dbRow = insertValues.mock.calls[0]?.[0] as { payloadJson: string };
    expect(JSON.parse(dbRow.payloadJson)).toEqual({ outboxId: "abc", email: "secret@example.com" });
  });
});
