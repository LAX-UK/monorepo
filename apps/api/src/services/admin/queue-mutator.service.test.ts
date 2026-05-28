import { describe, expect, it, vi, beforeEach } from "vitest";
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
  const db = {
    select: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks pause on high-criticality queues in production", async () => {
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "production");
    await expect(mutator.pause("email", { userId: "u1", staffRole: "super_admin" })).rejects.toThrow(
      "mutations_disabled_in_prod",
    );
    expect(mockQueue.pause).not.toHaveBeenCalled();
  });

  it("blocks retry in production even when allowUiRetries is true", async () => {
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "production");
    await expect(
      mutator.retry("validate-upload", "job-1", { userId: "u1", staffRole: "super_admin" }),
    ).rejects.toThrow("retries_disabled");
  });

  it("allows pause on non-high-criticality queues in production", async () => {
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "production");
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

  it("uses stable replay job id without colons", () => {
    expect(dlqReplayJobId("dlq:email:job-1")).toBe("replay-dlq-email-job-1");
  });

  it("rejects replay when already replayed", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "dlq:email:1",
                originalQueue: "email",
                payloadJson: '{"outboxId":"x"}',
                replayedAt: new Date(),
              },
            ]),
          }),
        }),
      }),
      update: vi.fn(),
    };
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "development");
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("already_replayed");
  });

  it("rejects replay when atomic claim fails", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "dlq:email:1",
                originalQueue: "email",
                payloadJson: '{"outboxId":"x"}',
                replayedAt: null,
                originalJobName: "publish",
                originalJobId: "1",
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "development");
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("already_replayed");
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it("rejects replay when payload JSON is malformed", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "dlq:email:1",
                originalQueue: "email",
                payloadJson: "{not-json",
                replayedAt: null,
                originalJobName: "publish",
                originalJobId: "1",
              },
            ]),
          }),
        }),
      }),
      update: vi.fn(),
    };
    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "development");
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("invalid_payload");
  });

  it("claims replay before enqueue and uses stable job id", async () => {
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.getJobs.mockResolvedValue([]);
    const claimReturning = vi.fn().mockResolvedValue([
      { id: "dlq:email:1", originalQueue: "email", replayedAt: new Date() },
    ]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "dlq:email:1",
                originalQueue: "email",
                payloadJson: '{"outboxId":"x"}',
                replayedAt: null,
                originalJobName: "publish",
                originalJobId: "1",
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: claimReturning,
          }),
        }),
      }),
    };

    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "development");
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
    const revertWhere = vi.fn().mockResolvedValue(undefined);
    const claimReturning = vi.fn().mockResolvedValue([
      { id: "dlq:email:1", originalQueue: "email", replayedAt: new Date() },
    ]);
    const revertSet = vi.fn().mockReturnValue({ where: revertWhere });
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "dlq:email:1",
                originalQueue: "email",
                payloadJson: '{"outboxId":"x"}',
                replayedAt: null,
                originalJobName: "publish",
                originalJobId: "1",
              },
            ]),
          }),
        }),
      }),
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: claimReturning,
            }),
          }),
        })
        .mockReturnValueOnce({
          set: revertSet,
        }),
    };

    const mutator = new BullMQQueueMutator({} as never, redis as never, db as never, audit, "development");
    await expect(
      mutator.replayFromDlq("dlq:email:1", { userId: "u1", staffRole: "super_admin" }, true),
    ).rejects.toThrow("redis down");

    expect(revertSet).toHaveBeenCalledWith({ replayedAt: null, replayedBy: null });
    expect(revertWhere).toHaveBeenCalled();
  });
});
