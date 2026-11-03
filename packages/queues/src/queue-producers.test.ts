import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { bindAtgSyncQueue, bindEmailAddressReactivationQueue } from "./queue-producers.js";

function queueWith(state: string | null): Queue {
  return {
    getJob: vi.fn().mockResolvedValue(state == null ? undefined : { getState: async () => state }),
  } as unknown as Queue;
}

describe("bindAtgSyncQueue.getJobState", () => {
  it.each([
    [null, "done"],
    ["completed", "done"],
    ["unknown", "done"],
    ["failed", "failed"],
    ["active", "active"],
    ["waiting", "waiting"],
    ["delayed", "waiting"],
    ["prioritized", "waiting"],
  ])("maps BullMQ state %s to %s", async (state, expected) => {
    expect(await bindAtgSyncQueue(queueWith(state)).getJobState("job-1")).toBe(expected);
  });
});

describe("bindEmailAddressReactivationQueue", () => {
  it("queues a retrying job that carries ids and no address", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    await bindEmailAddressReactivationQueue({ add } as unknown as Queue, () => 42).request({
      userId: "u1",
      emailHash: "h1",
    });
    expect(add).toHaveBeenCalledWith(
      "reactivate-email-address",
      { userId: "u1", emailHash: "h1" },
      expect.objectContaining({ jobId: "reactivate-h1-42", attempts: 5 }),
    );
  });
});
