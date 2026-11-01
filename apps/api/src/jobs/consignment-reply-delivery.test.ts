import { CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME } from "@auction/queues";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConsignmentReplyDeliveryQueue,
  REPLY_DELIVERY_MARGIN_MS,
  REPLY_SCHEDULE_TIMEOUT_MS,
  replyDeliveryJobId,
} from "./consignment-reply-delivery.js";

function queueWith(queue: { add: unknown; getJob: unknown }) {
  // Built without its constructor, so no test opens a connection to Redis.
  const adapter: ConsignmentReplyDeliveryQueue = Object.create(
    ConsignmentReplyDeliveryQueue.prototype,
  );
  Object.defineProperty(adapter, "queue", { value: queue });
  return adapter;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ConsignmentReplyDeliveryQueue", () => {
  it("is its own queue, registered in the queue registry", () => {
    expect(CONSIGNMENT_REPLY_DELIVERY_QUEUE_NAME).toBe("consignment-reply-delivery");
  });

  it("schedules one job per reply, a little after the hold ends", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-29T10:00:00Z") });
    const add = vi.fn().mockResolvedValue(undefined);
    await queueWith({ add, getJob: vi.fn() }).schedule("m1", new Date("2026-10-29T10:00:10Z"));
    expect(add).toHaveBeenCalledWith(
      "deliver",
      { messageId: "m1" },
      { delay: 10_000 + REPLY_DELIVERY_MARGIN_MS, jobId: replyDeliveryJobId("m1") },
    );
    expect(replyDeliveryJobId("m1")).not.toContain(":");
  });

  it("removes the job when the reply is taken back", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const getJob = vi.fn().mockResolvedValue({ remove });
    await queueWith({ add: vi.fn(), getJob }).cancel("m1");
    expect(getJob).toHaveBeenCalledWith("reply-m1");
    expect(remove).toHaveBeenCalledOnce();
    await expect(
      queueWith({ add: vi.fn(), getJob: vi.fn().mockResolvedValue(null) }).cancel("m2"),
    ).resolves.toBeUndefined();
  });

  it("gives up on a queue that does not answer, so the reply can go at once", async () => {
    vi.useFakeTimers();
    const never = new Promise(() => undefined);
    const pending = queueWith({ add: vi.fn(() => never), getJob: vi.fn() }).schedule(
      "m1",
      new Date(Date.now() + 10_000),
    );
    const outcome = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(REPLY_SCHEDULE_TIMEOUT_MS + 1);
    await outcome;
  });

  it("passes on a refusal from the queue", async () => {
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    await expect(
      queueWith({ add, getJob: vi.fn() }).schedule("m1", new Date(Date.now() + 10_000)),
    ).rejects.toThrow("redis down");
  });
});
