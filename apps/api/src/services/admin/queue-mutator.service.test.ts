import { beforeEach, describe, expect, it, vi } from "vitest";
import { BullMQQueueMutator, dlqReplayJobId } from "./queue-mutator.service.js";

const mockQueue = {
  getJob: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  add: vi.fn(),
  getJobs: vi.fn(),
};

vi.mock("bullmq", () => ({
  Queue: vi.fn(() => mockQueue),
}));

describe("BullMQQueueMutator production policy", () => {
  const audit = { log: vi.fn() };
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };
  const failedJobs = {
    findById: vi.fn(),
    claimReplay: vi.fn(),
    clearReplayClaim: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks pause on high-criticality queues in production", async () => {
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "production",
    );
    await expect(
      mutator.pause("email", { userId: "u1", staffRole: "super_admin" }),
    ).rejects.toThrow("mutations_disabled_in_prod");
    expect(mockQueue.pause).not.toHaveBeenCalled();
  });

  it("blocks retry in production even when allowUiRetries is true", async () => {
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "production",
    );
    await expect(
      mutator.retry("validate-upload", "job-1", { userId: "u1", staffRole: "super_admin" }),
    ).rejects.toThrow("retries_disabled");
  });

  it("allows pause on non-high-criticality queues in production", async () => {
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "production",
    );
    await mutator.pause("impersonation-sweeper", { userId: "u1", staffRole: "super_admin" });
    expect(mockQueue.pause).toHaveBeenCalledOnce();
  });
});

describe("BullMQQueueMutator DLQ replay", () => {
  const audit = { log: vi.fn() };
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  };

  const baseRow = {
    id: "dlq:email:1",
    originalQueue: "email",
    originalJobName: "publish",
    originalJobId: "1",
    payloadJson: '{"outboxId":"x"}',
    replayedAt: null as Date | null,
  };

  it("uses stable replay job id without colons", () => {
    expect(dlqReplayJobId("dlq:email:job-1")).toBe("replay-dlq-email-job-1");
  });

  it("rejects replay when already replayed", async () => {
    const failedJobs = {
      findById: vi.fn().mockResolvedValue({ ...baseRow, replayedAt: new Date() }),
      claimReplay: vi.fn(),
      clearReplayClaim: vi.fn(),
    };
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "development",
    );
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("already_replayed");
  });

  it("rejects replay when atomic claim fails", async () => {
    const failedJobs = {
      findById: vi.fn().mockResolvedValue(baseRow),
      claimReplay: vi.fn().mockResolvedValue(null),
      clearReplayClaim: vi.fn(),
    };
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "development",
    );
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("already_replayed");
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it("rejects replay when payload JSON is malformed", async () => {
    const failedJobs = {
      findById: vi.fn().mockResolvedValue({ ...baseRow, payloadJson: "{not-json" }),
      claimReplay: vi.fn(),
      clearReplayClaim: vi.fn(),
    };
    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "development",
    );
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("invalid_payload");
  });

  it("claims replay before enqueue and uses stable job id", async () => {
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.getJobs.mockResolvedValue([]);
    const failedJobs = {
      findById: vi.fn().mockResolvedValue(baseRow),
      claimReplay: vi.fn().mockResolvedValue({ ...baseRow, replayedAt: new Date() }),
      clearReplayClaim: vi.fn(),
    };

    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "development",
    );
    await mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true);

    expect(mockQueue.add).toHaveBeenCalledWith(
      "publish",
      { outboxId: "x" },
      expect.objectContaining({ jobId: "replay-dlq-email-1" }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      "replay_dlq",
      expect.objectContaining({ success: true, jobId: "dlq:email:1" }),
    );
  });

  it("reverts replay claim when enqueue fails", async () => {
    mockQueue.add.mockRejectedValue(new Error("redis down"));
    mockQueue.getJobs.mockResolvedValue([]);
    const clearReplayClaim = vi.fn().mockResolvedValue(undefined);
    const failedJobs = {
      findById: vi.fn().mockResolvedValue(baseRow),
      claimReplay: vi.fn().mockResolvedValue({ ...baseRow, replayedAt: new Date() }),
      clearReplayClaim,
    };

    const mutator = new BullMQQueueMutator(
      {} as never,
      redis as never,
      failedJobs as never,
      audit,
      "development",
    );
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("redis down");

    expect(clearReplayClaim).toHaveBeenCalledWith("dlq:email:1");
  });
});
