import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { bindAtgSyncQueue } from "./queue-producers.js";

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
