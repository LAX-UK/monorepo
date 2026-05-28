import { beforeEach, describe, expect, it, vi } from "vitest";
import { BullMQQueueInspector } from "./queue-inspector.service.js";

const mockDlq = {
  getJobs: vi.fn(),
  getJobCounts: vi.fn(),
  isPaused: vi.fn(),
};

const mockQueue = {
  getJobCounts: vi.fn(),
  isPaused: vi.fn().mockResolvedValue(false),
};

vi.mock("bullmq", () => ({
  Queue: vi.fn((name: string) => (name === "dead-letter" ? mockDlq : mockQueue)),
}));

describe("BullMQQueueInspector dlqDepth", () => {
  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    });
    mockDlq.getJobs.mockImplementation(async (statuses: string[]) => {
      if (statuses.includes("waiting")) {
        return [
          { id: "dlq:email:1:123", data: { originalQueue: "email" } },
          { id: "dlq:payout-statements:2:456", data: { originalQueue: "payout-statements" } },
        ];
      }
      return [];
    });
  });

  it("counts DLQ jobs per source queue", async () => {
    const inspector = new BullMQQueueInspector({} as never, redis as never, {
      appEnv: "development",
      marketingEventsEnabled: false,
    });
    const rows = await inspector.list();
    const email = rows.find((r) => r.name === "email");
    const payouts = rows.find((r) => r.name === "payout-statements");
    expect(email?.dlqDepth).toBe(1);
    expect(payouts?.dlqDepth).toBe(1);
  });
});
