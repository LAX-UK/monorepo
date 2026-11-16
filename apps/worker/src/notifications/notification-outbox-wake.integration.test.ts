import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import { notification, notificationOutbox, user } from "@auction/db/schema";
import type { NotificationPayload } from "@auction/persistence/interfaces";
import {
  NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
  NOTIFICATION_OUTBOX_WAKE_CHANNEL,
  notificationOutboxRetryDelayMs,
} from "@auction/persistence/lib";
import {
  DrizzleNotificationOutboxRepository,
  DrizzleNotificationWriteRepository,
} from "@auction/persistence/repositories";
import { PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME } from "@auction/queues";
import { Queue, QueueEvents } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { Redis } from "ioredis";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../env.js";
import { WorkerNotificationOutboxDrain } from "../finance/worker-notification-outbox-drain.js";
import { runProcessNotificationOutboxWakeJob } from "../jobs/payment-ops-cron.js";
import { registerNotificationOutboxWorkers } from "../workers/register-notification-outbox-workers.js";
import type { WorkerBootstrapDeps } from "../workers/types.js";
import {
  NOTIFICATION_OUTBOX_WAKE_JOB_NAME,
  WAKE_BUCKET_MS,
  WAKE_SETTLE_DELAY_MS,
} from "./notification-outbox-wake-scheduler.js";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

/** The bar the live sale needs: an outbid notice on screen within a few seconds of the bid. */
const DELIVERY_BUDGET_MS = 3_000;
/**
 * How long the test polls for things to happen on a slow CI runner. Waiting this long is not what
 * the test proves: the delivery latency is measured from the commit and held to the budget above.
 */
const CI_DEADLINE_MS = 20_000;
/**
 * A sweep due within this long of now could run while a notice is in flight, so it is waited out.
 * Every check that no sweep ran (delivery and the signal's follow-up drain) ends inside this window.
 */
const SWEEP_CLEARANCE_MS = DELIVERY_BUDGET_MS + WAKE_SETTLE_DELAY_MS + 2_000;
/** Longest wait for the sweep window to clear: one sweep interval, the clearance, and CI slack. */
const CLEAR_OF_SWEEPS_TIMEOUT_MS = 60_000 + SWEEP_CLEARANCE_MS + CI_DEADLINE_MS;

const isWakeJob = (jobId: string | undefined) =>
  jobId?.startsWith(`${NOTIFICATION_OUTBOX_WAKE_JOB_NAME}-`) ?? false;
const wakeBucket = (jobId: string, kind: "now" | "settle") => {
  const prefix = `${NOTIFICATION_OUTBOX_WAKE_JOB_NAME}-${kind}-`;
  return jobId.startsWith(prefix) ? Number(jobId.slice(prefix.length)) : Number.NaN;
};

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
  const prefix = `outbox-wake-${run}`;
  const queue = new Queue(PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME, { connection: redis, prefix });
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const eventsRedis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
  const queueEvents = new QueueEvents(PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME, {
    connection: eventsRedis,
    prefix,
  });
  /** Every job start and finish on the outbox queue, in the order Redis recorded them. */
  const events: Array<{ kind: "active" | "completed" | "failed"; jobId: string }> = [];
  /** Jobs started and not yet finished. */
  const running = new Set<string>();
  queueEvents.on("active", ({ jobId }) => {
    events.push({ kind: "active", jobId });
    running.add(jobId);
  });
  const finished = (kind: "completed" | "failed", jobId: string) => {
    events.push({ kind, jobId });
    running.delete(jobId);
  };
  queueEvents.on("completed", ({ jobId }) => finished("completed", jobId));
  queueEvents.on("failed", ({ jobId }) => finished("failed", jobId));

  /**
   * Wait until no minute sweep is running or due within {@link SWEEP_CLEARANCE_MS}, so whatever
   * delivers a notice staged next can only be a drain the commit-time signal woke. Returns the time
   * of the check that passed: no sweep starts before that time plus {@link SWEEP_CLEARANCE_MS}.
   */
  async function clearOfSweeps(): Promise<number> {
    return vi.waitFor(
      async () => {
        const checkedAt = Date.now();
        expect([...running].filter((id) => !isWakeJob(id))).toEqual([]);
        // "active" too: a sweep Redis has started can be listed before its event reaches us.
        // A job removed while it is listed comes back undefined: wake jobs are removed on completion.
        const pending = (await queue.getJobs(["active", "wait", "delayed", "prioritized"])).filter(
          (j) => j !== undefined,
        );
        const dueSoon = pending.filter(
          (j) => !isWakeJob(j.id) && j.timestamp + (j.delay ?? 0) < checkedAt + SWEEP_CLEARANCE_MS,
        );
        expect(dueSoon.map((j) => j.id)).toEqual([]);
        return checkedAt;
      },
      { timeout: CLEAR_OF_SWEEPS_TIMEOUT_MS, interval: 100 },
    );
  }

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: userId,
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Subscribed before the worker exists, so no job event is missed.
    await queueEvents.waitUntilReady();

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
        bullConnection: { connection: redis, prefix },
        sentryMonitorSlugs: {},
        heartbeat: async () => {},
        reportWorkerJobFailure: () => {},
      } as unknown as WorkerBootstrapDeps,
      jobOpts: { env, cronSecret: financeCron.cronSecret, log: log as never, financeCron },
      errorHandlers: [],
      closables,
    });
    // Ready means: the listener is on LISTEN, the worker is taking jobs under the queue's global
    // concurrency limit, and the wake the listener raises on connect has run its follow-up drain,
    // so that wake cannot be what delivers a row staged by a test.
    await vi.waitFor(
      () => {
        expect(log.info).toHaveBeenCalledWith(
          expect.anything(),
          "notification_outbox_wake_listening",
        );
        expect(
          events.some(
            (e) => e.kind === "completed" && !Number.isNaN(wakeBucket(e.jobId, "settle")),
          ),
        ).toBe(true);
      },
      { timeout: CI_DEADLINE_MS, interval: 50 },
    );
  }, CI_DEADLINE_MS + 10_000);

  afterAll(async () => {
    for (const c of closables.reverse()) await c.close().catch(() => {});
    await queue.close();
    await queueEvents.close();
    await eventsRedis.quit();
    await db.delete(user).where(eq(user.id, userId));
    await redis.quit();
    await closeDb(db);
  });

  it(
    "delivers a committed outbid notice within seconds, once, through the signal",
    async () => {
      const clearUntil = (await clearOfSweeps()) + SWEEP_CLEARANCE_MS;
      const key = `outbid:lot-${run}:bid-${run}:${userId}`;
      const eventsBefore = events.length;
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
        { timeout: CI_DEADLINE_MS, interval: 50 },
      );
      const latencyMs = (delivered?.createdAt.getTime() ?? 0) - committedAt;
      console.info(`outbid notice delivered ${latencyMs}ms after commit`);
      expect(latencyMs).toBeLessThan(DELIVERY_BUDGET_MS);

      // The signal's follow-up drain runs after the delivery and must not write the notice again.
      // The scheduler files a wake's drains under the time bucket each is due in, both from the same
      // clock reading, so the follow-up of the wake this commit raised (the first immediate drain
      // after staging) is the settle job exactly WAKE_SETTLE_DELAY_MS later, in buckets.
      expect(WAKE_SETTLE_DELAY_MS % WAKE_BUCKET_MS).toBe(0);
      const signalDrain = events
        .slice(eventsBefore)
        .find((e) => e.kind === "active" && !Number.isNaN(wakeBucket(e.jobId, "now")));
      expect(signalDrain).toBeDefined();
      const followUpId = `${NOTIFICATION_OUTBOX_WAKE_JOB_NAME}-settle-${
        wakeBucket(signalDrain?.jobId ?? "", "now") + WAKE_SETTLE_DELAY_MS / WAKE_BUCKET_MS
      }`;
      // Waited for only while the sweep window is still clear, so "no sweep ran" below covers it.
      await vi.waitFor(
        () =>
          expect(
            events
              .slice(eventsBefore)
              .some((e) => e.kind === "completed" && e.jobId === followUpId),
          ).toBe(true),
        { timeout: Math.max(0, clearUntil - Date.now()), interval: 50 },
      );
      const after = await db
        .select({ id: notification.id })
        .from(notification)
        .where(eq(notification.userId, userId));
      expect(after).toHaveLength(1);

      const [row] = await db
        .select({ state: notificationOutbox.state })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.idempotencyKey, key));
      expect(row?.state).toBe("sent");

      // Through the signal: from the commit until its follow-up finished, every job that ran on the
      // outbox queue was a wake drain. No minute sweep ran (none was running or due in the window).
      const ran = events.slice(eventsBefore).filter((e) => e.kind === "active");
      expect(ran.length).toBeGreaterThan(0);
      expect(ran.filter((e) => !isWakeJob(e.jobId))).toEqual([]);
    },
    // Worst case: the sweep wait, the delivery poll, and the follow-up inside the clearance.
    CLEAR_OF_SWEEPS_TIMEOUT_MS + CI_DEADLINE_MS + SWEEP_CLEARANCE_MS,
  );

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

/**
 * A short outage while a live sale wakes the drain every few hundred milliseconds must not use up
 * the outbox retry budget. Before the backoff, one wake re-claimed the same failing rows up to ten
 * times and dead-lettered critical notices within a second; the budget used to span about ten
 * minutes of minute sweeps. The clock is simulated (only `Date`), so ten minutes run in seconds.
 */
describe.skipIf(!databaseUrl || !redisUrl)("outbox retry backoff under wakes (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const userId = `outbox-backoff-${run}`;
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const db = createDb(databaseUrl!);
  // biome-ignore lint/style/noNonNullAssertion: gated above
  const redis = new Redis(redisUrl!, { maxRetriesPerRequest: null });
  const outbox = new DrizzleNotificationOutboxRepository(db);
  const ROWS = 60;
  /** How often a wake drain runs in the simulation (wakes come in pairs every 250 ms live). */
  const WAKE_EVERY_MS = 1_000;
  /** The retry budget before this change: ten attempts at one per minute sweep. */
  const OLD_BUDGET_WINDOW_MS = 10 * 60_000;

  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: userId,
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(notificationOutbox).values(
      Array.from({ length: ROWS }, (_, i) => ({
        idempotencyKey: `outbid:backoff-${run}:${i}:${userId}`,
        userId,
        payload: payload("outbid", `Backoff ${run} ${i}`),
        state: "pending",
        createdAt: new Date(Date.now() - 60_000),
      })),
    );
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(user).where(eq(user.id, userId));
    await redis.quit();
    await closeDb(db);
  });

  it("tries a failing row at most once per backoff step and dead-letters nothing within the old window", async () => {
    const drain = new WorkerNotificationOutboxDrain({
      outbox,
      notificationWrite: {
        createMany: async () => {
          throw new Error("transient blip");
        },
      } as never,
      redis,
    });
    const env = { FINANCE_CRON_EXECUTION_OWNER: "worker", FINANCE_CRON_API_ROLLBACK: false };
    const opts = {
      env,
      cronSecret: "x".repeat(32),
      log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      financeCron: {
        env,
        log: {},
        cronSecret: "x".repeat(32),
        handlers: { processNotificationOutbox: () => drain.processBatch(50) },
      },
    } as never;

    const start = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(start);
    /** Per row: the simulated times at which its attempts count rose. */
    const attemptsAt = new Map<string, number[]>();
    const lastAttempts = new Map<string, number>();
    let wakes = 0;
    for (let t = 0; t <= OLD_BUDGET_WINDOW_MS; t += WAKE_EVERY_MS) {
      vi.setSystemTime(start + t);
      await runProcessNotificationOutboxWakeJob(opts);
      wakes += 1;
      const rows = await db
        .select({ id: notificationOutbox.id, attempts: notificationOutbox.attempts })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.userId, userId));
      for (const row of rows) {
        const before = lastAttempts.get(row.id) ?? 0;
        // One wake tries a row at most once.
        expect(row.attempts - before).toBeLessThanOrEqual(1);
        if (row.attempts > before) attemptsAt.set(row.id, [...(attemptsAt.get(row.id) ?? []), t]);
        lastAttempts.set(row.id, row.attempts);
      }
    }
    vi.useRealTimers();

    expect(wakes).toBeGreaterThan(500);
    expect(attemptsAt.size).toBe(ROWS);
    for (const times of attemptsAt.values()) {
      // Each retry waited at least the backoff for the attempts made before it.
      for (let i = 1; i < times.length; i++) {
        expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(
          notificationOutboxRetryDelayMs(i),
        );
      }
      // 15 s, 30 s, 1 min, 2 min, 4 min: six attempts fit in ten minutes, well short of ten.
      expect(times.length).toBeLessThanOrEqual(6);
    }

    const terminal = await db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(and(eq(notificationOutbox.userId, userId), eq(notificationOutbox.state, "failed")));
    expect(terminal).toHaveLength(0);
    const maxAttempts = Math.max(...lastAttempts.values());
    expect(maxAttempts).toBeLessThan(NOTIFICATION_OUTBOX_MAX_ATTEMPTS);
  }, 120_000);
});
