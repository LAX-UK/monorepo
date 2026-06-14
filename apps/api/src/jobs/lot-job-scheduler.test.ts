import { LOT_LIFECYCLE_QUEUE_NAME } from "@auction/queues";
import { describe, expect, it, vi } from "vitest";
import { LotJobScheduler } from "./lot-job-scheduler.js";

describe("LotJobScheduler.cancelLotEndJob", () => {
  it("removes only the end job, not activate", async () => {
    const removed: string[] = [];
    const jobs = new Map<string, { remove: () => Promise<void> }>([
      [
        "activate-lot-1",
        {
          remove: vi.fn(async () => {
            removed.push("activate-lot-1");
          }),
        },
      ],
      [
        "end-lot-1",
        {
          remove: vi.fn(async () => {
            removed.push("end-lot-1");
          }),
        },
      ],
    ]);
    const queue = {
      getJob: vi.fn(async (id: string) => jobs.get(id) ?? null),
      add: vi.fn(),
    };
    const scheduler = new LotJobScheduler({} as never, vi.fn(), vi.fn());
    Object.defineProperty(scheduler, "queue", { value: queue });

    await scheduler.cancelLotEndJob("lot-1");

    expect(removed).toEqual(["end-lot-1"]);
  });
});

describe("LotJobScheduler queue name", () => {
  it("uses lot lifecycle queue", () => {
    expect(LOT_LIFECYCLE_QUEUE_NAME).toBeTruthy();
  });
});
