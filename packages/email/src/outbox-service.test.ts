import { emailSuppression } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { PostmarkEmailService } from "./outbox-service.js";

type OutboxLookupRow = { id: string; status: string } | undefined;

function createFakeDb(config: {
  outboxLookups: OutboxLookupRow[];
  suppressionRows?: Array<{ emailHash: string }>;
  insertReturning?: OutboxLookupRow[];
}) {
  const outboxLookups = [...config.outboxLookups];
  const insertReturning = [...(config.insertReturning ?? [])];
  const updateCalls: unknown[] = [];
  const insertCalls: unknown[] = [];

  const db = {
    select: (_cols: unknown) => ({
      from: (table: unknown) => ({
        where: (_cond: unknown) => ({
          limit: async (_n: number) => {
            if (table === emailSuppression) return config.suppressionRows ?? [];
            const next = outboxLookups.shift();
            return next ? [next] : [];
          },
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (values: unknown) => {
        updateCalls.push(values);
        return { where: async (_cond: unknown) => undefined };
      },
    }),
    insert: (_table: unknown) => ({
      values: (values: unknown) => {
        insertCalls.push(values);
        return {
          onConflictDoNothing: () => ({
            returning: async (_cols: unknown) => {
              const next = insertReturning.shift();
              return next ? [next] : [];
            },
          }),
        };
      },
    }),
  };

  return { db: db as never, updateCalls, insertCalls };
}

describe("PostmarkEmailService.enqueue", () => {
  it("creates a new outbox row and queues a send job when none exists yet", async () => {
    const { db, insertCalls } = createFakeDb({
      outboxLookups: [undefined],
      insertReturning: [{ id: "row-new", status: "pending" }],
    });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new PostmarkEmailService(db, queue);

    const result = await service.enqueue({
      template: "2fa-enabled",
      to: "ada@example.com",
      userId: "u1",
      category: "auth",
      vars: { userName: "Ada" },
    });

    expect(result).toEqual({ outboxId: "row-new" });
    expect(insertCalls).toHaveLength(1);
    expect(queue.add).toHaveBeenCalledWith(
      "send-email",
      { outboxId: "row-new" },
      expect.objectContaining({ jobId: "row-new" }),
    );
  });

  it("dedupes without re-queuing when a live (non-failed) row already exists for this idempotency key", async () => {
    const { db, updateCalls } = createFakeDb({
      outboxLookups: [{ id: "row-pending", status: "pending" }],
    });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new PostmarkEmailService(db, queue);

    const result = await service.enqueue({
      template: "2fa-enabled",
      to: "ada@example.com",
      userId: "u1",
      category: "auth",
      vars: { userName: "Ada" },
    });

    expect(result).toEqual({ outboxId: "row-pending" });
    expect(updateCalls).toHaveLength(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("re-arms and re-queues a terminally-failed row instead of permanently blocking the notification", async () => {
    // Regression guard: previously, once a (template, user, vars) combination hit
    // status='failed' after 5 attempts, every future enqueue() for that exact
    // combination silently matched the dead row and never sent again.
    const { db, updateCalls } = createFakeDb({
      outboxLookups: [{ id: "row-dead", status: "failed" }],
    });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new PostmarkEmailService(db, queue);

    const result = await service.enqueue({
      template: "2fa-enabled",
      to: "ada@example.com",
      userId: "u1",
      category: "auth",
      vars: { userName: "Ada" },
    });

    expect(result).toEqual({ outboxId: "row-dead" });
    expect(updateCalls).toEqual([
      { status: "pending", attempts: 0, lastError: null, messageId: null },
    ]);
    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = queue.add.mock.calls[0] as [
      string,
      { outboxId: string },
      { jobId: string },
    ];
    expect(name).toBe("send-email");
    expect(data).toEqual({ outboxId: "row-dead" });
    // Must NOT reuse the original jobId (== outboxId): BullMQ dedupes by jobId, so
    // re-adding under the same id would be silently swallowed rather than re-run.
    expect(opts.jobId).not.toBe("row-dead");
    expect(opts.jobId).toContain("row-dead:retry:");
  });

  it("does not re-queue a 'sent' row (already delivered successfully)", async () => {
    const { db, updateCalls } = createFakeDb({
      outboxLookups: [{ id: "row-sent", status: "sent" }],
    });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new PostmarkEmailService(db, queue);

    const result = await service.enqueue({
      template: "2fa-disabled",
      to: "ada@example.com",
      userId: "u1",
      category: "auth",
      vars: { userName: "Ada" },
    });

    expect(result).toEqual({ outboxId: "row-sent" });
    expect(updateCalls).toHaveLength(0);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
