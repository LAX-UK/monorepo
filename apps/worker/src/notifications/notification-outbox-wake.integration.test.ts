import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import { notification, notificationOutbox, user } from "@auction/db/schema";
import type { NotificationPayload } from "@auction/persistence/interfaces";
import { NOTIFICATION_OUTBOX_WAKE_CHANNEL } from "@auction/persistence/lib";
import {
  DrizzleNotificationOutboxRepository,
  DrizzleNotificationWriteRepository,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { Redis } from "ioredis";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../env.js";
import { WorkerNotificationOutboxDrain } from "../finance/worker-notification-outbox-drain.js";
import { registerNotificationOutboxWorkers } from "../workers/register-notification-outbox-workers.js";
import type { WorkerBootstrapDeps } from "../workers/types.js";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

/** The bar the live sale needs: an outbid notice on screen within a few seconds of the bid. */
const DELIVERY_BUDGET_MS = 3_000;

function payload(type: string, title: string): NotificationPayload {
  return { type, title, message: `${title} (integration)`, legalEntityId: null };
}

/**
 * A staged outbid row reaches the person's notifications within seconds of its transaction
 * committing, through the real path: the outbox repository's commit-time signal, the worker's
 * LISTEN connection, the outbox queue on Redis and the worker's outbox drain. The minute sweep is
 * registered as in production but cannot be what delivers it inside the budget.
 */
describe.skipIf(!databaseUrl || !redisUrl)("critical notification wake (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const userId = `outbox-wake-${run}`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const db = createDb(databaseUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
  const outbox = new DrizzleNotificationOutboxRepository(db);
  const closables: Array<{ close: () => Promise<void> }> = [];
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: userId,
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const drain = new WorkerNotificationOutboxDrain({
      outbox,
      notificationWrite: new DrizzleNotificationWriteRepository(db),
      redis,
    });
    const env = {
      // biome-ignore lint/style/noNonNullAssertion: gated above
      DATABASE_URL: databaseUrl!,
      DATABASE_URL_WORKER: undefined,
      FINANCE_CRON_EXECUTION_OWNER: "worker",
      FINANCE_CRON_API_ROLLBACK: false,
      NOTIFICATION_OUTBOX_WAKE_ENABLED: true,
    } as unknown as WorkerEnv;
    const financeCron = {
      env,
      log: log as never,
      cronSecret: "x".repeat(32),
      handlers: { processNotificationOutbox: () => drain.processBatch(50) } as never,
    };
    registerNotificationOutboxWorkers({
      deps: {
        env,
        log,
        bullConnection: { connection: redis, prefix: `outbox-wake-${run}` },
        sentryMonitorSlugs: {},
        heartbeat: async () => {},
        reportWorkerJobFailure: () => {},
      } as unknown as WorkerBootstrapDeps,
      jobOpts: { env, cronSecret: financeCron.cronSecret, log: log as never, financeCron },
      errorHandlers: [],
      closables,
    });
    await vi.waitFor(
      () =>
        expect(log.info).toHaveBeenCalledWith(
          expect.anything(),
          "notification_outbox_wake_listening",
        ),
      { timeout: 10_000 },
    );
  }, 20_000);

  afterAll(async () => {
    for (const c of closables.reverse()) await c.close().catch(() => {});
    await db.delete(user).where(eq(user.id, userId));
    await redis.quit();
    await closeDb(db);
  });

  it("delivers a committed outbid notice within seconds, once", async () => {
    const key = `outbid:lot-${run}:bid-${run}:${userId}`;
    const committedAt = await db.transaction(async (tx) => {
      await outbox.stage(
        { userId, payload: payload("outbid", `Outbid ${run}`), idempotencyKey: key },
        tx as never,
      );
      return Date.now();
    });

    const delivered = await vi.waitFor(
      async () => {
        const rows = await db
          .select({ createdAt: notification.createdAt })
          .from(notification)
          .where(eq(notification.userId, userId));
        expect(rows).toHaveLength(1);
        return rows[0];
      },
      { timeout: DELIVERY_BUDGET_MS + 2_000, interval: 50 },
    );
    const latencyMs = (delivered?.createdAt.getTime() ?? 0) - committedAt;
    console.info(`outbid notice delivered ${latencyMs}ms after commit`);
    expect(latencyMs).toBeLessThan(DELIVERY_BUDGET_MS);

    const [row] = await db
      .select({ state: notificationOutbox.state })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.idempotencyKey, key));
    expect(row?.state).toBe("sent");

    // The follow-up drain runs after this and must not write the notice again.
    await new Promise((r) => setTimeout(r, 2_000));
    const after = await db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.userId, userId));
    expect(after).toHaveLength(1);
  }, 15_000);

  it("delivers outbid notices for one person in the order they were staged", async () => {
    const keys = [1, 2, 3].map((n) => `outbid:lot-${run}:order-${n}:${userId}`);
    for (const [i, key] of keys.entries()) {
      await db.transaction(async (tx) => {
        await outbox.stage(
          { userId, payload: payload("outbid", `Order ${run} ${i + 1}`), idempotencyKey: key },
          tx as never,
        );
      });
    }
    const titles = await vi.waitFor(
      async () => {
        const rows = await db
          .select({ title: notification.title, createdAt: notification.createdAt })
          .from(notification)
          .where(eq(notification.userId, userId));
        const ordered = rows
          .filter((r) => r.title.startsWith(`Order ${run}`))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        expect(ordered).toHaveLength(3);
        return ordered.map((r) => r.title);
      },
      { timeout: DELIVERY_BUDGET_MS + 2_000, interval: 50 },
    );
    expect(titles).toEqual([1, 2, 3].map((n) => `Order ${run} ${n}`));
    await db.delete(notificationOutbox).where(inArray(notificationOutbox.idempotencyKey, keys));
  }, 15_000);
});

/** The commit-time signal itself: sent for critical kinds on commit, never on rollback or for routine kinds. */
describe.skipIf(!databaseUrl)("notification outbox commit signal (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const userId = `outbox-signal-${run}`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const db = createDb(databaseUrl!);
  const outbox = new DrizzleNotificationOutboxRepository(db);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const listener = new pg.Client({ connectionString: databaseUrl! });
  const signals: number[] = [];

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: userId,
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await listener.connect();
    listener.on("notification", (msg) => {
      if (msg.channel === NOTIFICATION_OUTBOX_WAKE_CHANNEL) signals.push(Date.now());
    });
    await listener.query(`LISTEN ${NOTIFICATION_OUTBOX_WAKE_CHANNEL}`);
  });

  afterAll(async () => {
    await listener.end();
    await db.delete(user).where(eq(user.id, userId));
    await closeDb(db);
  });

  const settle = () => new Promise((r) => setTimeout(r, 300));

  it("signals once per committing transaction, only after commit", async () => {
    signals.length = 0;
    let inTxSignals = -1;
    await db.transaction(async (tx) => {
      for (const kind of ["lot_won", "lot_lost"]) {
        await outbox.stage(
          { userId, payload: payload(kind, kind), idempotencyKey: `${kind}:${run}:${userId}` },
          tx as never,
        );
      }
      await settle();
      inTxSignals = signals.length;
    });
    await settle();
    expect(inTxSignals).toBe(0);
    expect(signals).toHaveLength(1);
  });

  it("does not signal for a rolled-back stage or a duplicate key", async () => {
    signals.length = 0;
    await db
      .transaction(async (tx) => {
        await outbox.stage(
          { userId, payload: payload("outbid", "rolled back"), idempotencyKey: `rb:${run}` },
          tx as never,
        );
        throw new Error("rollback");
      })
      .catch(() => {});
    const again = await outbox.stage({
      userId,
      payload: payload("lot_won", "dup"),
      idempotencyKey: `lot_won:${run}:${userId}`,
    });
    await settle();
    expect(again).toBe(false);
    expect(signals).toHaveLength(0);
  });

  it("does not signal for routine kinds", async () => {
    signals.length = 0;
    await outbox.stage({
      userId,
      payload: payload("payment_reminder", "reminder"),
      idempotencyKey: `payment_reminder:${run}:${userId}`,
    });
    await settle();
    expect(signals).toHaveLength(0);
  });
});
