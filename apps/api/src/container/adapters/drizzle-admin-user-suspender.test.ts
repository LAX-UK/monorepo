import { beforeEach, describe, expect, it, vi } from "vitest";

const writeBidUserProfile = vi.fn();
vi.mock("@auction/persistence/bid-user-profile-sync", () => ({
  writeBidUserProfile: (...args: unknown[]) => writeBidUserProfile(...args),
}));

import { DrizzleAdminUserSuspender } from "./drizzle-admin-user-suspender.js";

const ACTOR = "admin-1";
const REASON = "Repeated chargebacks and a failed identity check.";

type EventRow = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  producer: string;
  payload: Record<string, unknown>;
  actorUserId: string;
};

function fakeDb(options: { failOnWriteFor?: string } = {}) {
  const log: string[] = [];
  const committedEvents: EventRow[] = [];
  const tx = {
    insert: () => ({
      values: async (rows: EventRow[]) => {
        log.push("tx:events");
        committedEvents.push(...rows);
      },
    }),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: async () => [
          { subjectId: "u1", email: "one@example.com", name: "One" },
          { subjectId: "u2", email: "two@example.com", name: "Two" },
        ],
      }),
    }),
    transaction: async (callback: (t: typeof tx) => Promise<void>) => {
      log.push("tx:begin");
      const staged = committedEvents.length;
      try {
        await callback(tx);
        log.push("tx:commit");
      } catch (error) {
        committedEvents.length = staged;
        log.push("tx:rollback");
        throw error;
      }
    },
  };
  writeBidUserProfile.mockImplementation(async (_tx: unknown, userId: string) => {
    if (userId === options.failOnWriteFor) throw new Error("write failed");
    log.push(`write:${userId}`);
  });
  return { db, log, committedEvents };
}

describe("DrizzleAdminUserSuspender", () => {
  beforeEach(() => {
    writeBidUserProfile.mockReset();
  });

  it("suspends every account and records one audit event each, with actor and reason, in one transaction", async () => {
    const { db, log, committedEvents } = fakeDb();
    const suspender = new DrizzleAdminUserSuspender(db as never);

    await suspender.suspendMany({
      userIds: ["u1", "u2", "u1"],
      reason: REASON,
      actorUserId: ACTOR,
      bulk: true,
    });

    expect(log).toEqual(["tx:begin", "write:u1", "write:u2", "tx:events", "tx:commit"]);
    expect(committedEvents).toEqual([
      expect.objectContaining({
        aggregateType: "user",
        aggregateId: "u1",
        eventType: "bid.user_suspended",
        producer: "apps/api",
        payload: { reason: REASON, bulk: true },
        actorUserId: ACTOR,
      }),
      expect.objectContaining({
        aggregateId: "u2",
        eventType: "bid.user_suspended",
        payload: { reason: REASON, bulk: true },
        actorUserId: ACTOR,
      }),
    ]);
    expect(writeBidUserProfile).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({ suspendedReason: REASON, suspendedAt: expect.any(Date) }),
    );
  });

  it("leaves no audit event and queues no email when a write fails mid-batch", async () => {
    const { db, log, committedEvents } = fakeDb({ failOnWriteFor: "u2" });
    const enqueue = vi.fn();
    const suspender = new DrizzleAdminUserSuspender(db as never, {
      emailService: { enqueue } as never,
    });

    await expect(
      suspender.suspendMany({
        userIds: ["u1", "u2"],
        reason: REASON,
        actorUserId: ACTOR,
        bulk: true,
      }),
    ).rejects.toThrow("write failed");

    expect(log).toContain("tx:rollback");
    expect(log).not.toContain("tx:commit");
    expect(committedEvents).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues the account-suspended email after the transaction commits", async () => {
    const { db, log } = fakeDb();
    const enqueue = vi.fn(async () => {
      log.push("email");
    });
    const suspender = new DrizzleAdminUserSuspender(db as never, {
      emailService: { enqueue } as never,
      accountSuspendedSupportEmail: "help@example.com",
    });

    await suspender.suspendMany({
      userIds: ["u1"],
      reason: REASON,
      actorUserId: ACTOR,
      bulk: false,
    });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "account-suspended",
        to: "one@example.com",
        userId: "u1",
        vars: { userName: "One", supportContactEmail: "help@example.com" },
      }),
    );
    expect(log.indexOf("email")).toBeGreaterThan(log.indexOf("tx:commit"));
  });

  it("keeps the suspension when the email cannot be queued", async () => {
    const { db, committedEvents } = fakeDb();
    const suspender = new DrizzleAdminUserSuspender(db as never, {
      emailService: { enqueue: vi.fn().mockRejectedValue(new Error("queue down")) } as never,
    });

    await expect(
      suspender.suspendMany({ userIds: ["u1"], reason: REASON, actorUserId: ACTOR, bulk: false }),
    ).resolves.toBeUndefined();

    expect(committedEvents).toHaveLength(1);
  });

  it("records an unsuspend audit event with the actor, in one transaction", async () => {
    const { db, log, committedEvents } = fakeDb();
    const suspender = new DrizzleAdminUserSuspender(db as never);

    await suspender.unsuspendMany({ userIds: ["u1", "u2"], actorUserId: ACTOR, bulk: true });

    expect(log).toEqual(["tx:begin", "write:u1", "write:u2", "tx:events", "tx:commit"]);
    expect(committedEvents).toEqual([
      expect.objectContaining({
        aggregateId: "u1",
        eventType: "bid.user_unsuspended",
        payload: { bulk: true },
        actorUserId: ACTOR,
      }),
      expect.objectContaining({ aggregateId: "u2", eventType: "bid.user_unsuspended" }),
    ]);
    expect(writeBidUserProfile).toHaveBeenCalledWith(expect.anything(), "u1", {
      suspendedAt: null,
      suspendedReason: null,
    });
  });

  it("does nothing for an empty batch", async () => {
    const { db, log } = fakeDb();
    const suspender = new DrizzleAdminUserSuspender(db as never);

    await suspender.suspendMany({ userIds: [], reason: REASON, actorUserId: ACTOR, bulk: true });
    await suspender.unsuspendMany({ userIds: [], actorUserId: ACTOR, bulk: true });

    expect(log).toEqual([]);
  });
});
