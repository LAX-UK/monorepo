import { createHash, randomUUID } from "node:crypto";
import { type Database, closeDb, createDb } from "@auction/db";
import { bidSsfReplay, bidUserProfile } from "@auction/db/schema";
import type { NormalizedSsfSignal } from "@auction/identity-contracts";
import { SSF_EVENT_TYPES } from "@auction/identity-contracts";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBidSsfEventsRoute } from "../routes/ssf-events.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../testing/identity-user-fixtures.js";
import { createBidSsfReplayStore } from "./drizzle-bid-ssf-receiver.js";

const signalsByToken = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@auction/identity-contracts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@auction/identity-contracts")>();
  return {
    ...original,
    verifyAndConsumeSet: vi.fn(
      async (options: {
        token: string;
        replayStore: { consume(signal: NormalizedSsfSignal, expiresAt: Date): Promise<boolean> };
      }) => {
        const signal = signalsByToken.get(options.token) as NormalizedSsfSignal | undefined;
        if (!signal) throw new Error("missing_test_signal");
        await options.replayStore.consume(signal, new Date("2026-08-28T20:10:00.000Z"));
        return signal;
      },
    ),
  };
});

const HAS_DB = Boolean(process.env.DATABASE_URL);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function orderedJti(subjectId: string, eventId: number, nonce: string): string {
  const subjectKey = createHash("sha256").update(subjectId).digest("base64url");
  return `lax-identity-outbox-v1.${subjectKey}.${eventId}.${nonce}`;
}

function signal(
  subjectId: string,
  eventType: NormalizedSsfSignal["eventType"],
  jti: string,
): NormalizedSsfSignal {
  return {
    issuer: "https://auth.test",
    audience: "lax-bid-api",
    issuedAt: 1_786_000_000,
    jti,
    subjectId,
    eventType,
    event: {},
  };
}

describe.skipIf(!HAS_DB)("Bid SSF receiver concurrency (integration)", () => {
  let cleanupDb: Database;
  let blockerDb: Database;
  let newerDb: Database;
  let staleDb: Database;
  let monitorDb: Database;
  let subjectId = "";
  let fixtureJtis: string[] = [];
  let releaseHeldLock: (() => void) | undefined;
  let inFlight: Promise<unknown>[] = [];

  async function waitForReceiverLockWaiters(expected: number): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const result = await monitorDb.execute<{ count: number }>(sql`
        SELECT count(*)::integer AS "count"
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%bid_user_profile%'
          AND query ILIKE '%for update%'
      `);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count >= expected) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    throw new Error(`timed_out_waiting_for_${expected}_ssf_receiver_lock_waiters`);
  }

  async function cleanup(): Promise<void> {
    releaseHeldLock?.();
    await Promise.allSettled(inFlight);
    if (fixtureJtis.length > 0) {
      await cleanupDb.delete(bidSsfReplay).where(inArray(bidSsfReplay.jti, fixtureJtis));
    }
    if (subjectId) {
      await cleanupDb.delete(bidUserProfile).where(eq(bidUserProfile.userId, subjectId));
      await deleteIdentityUserFixtures(cleanupDb, [subjectId]);
    }
    releaseHeldLock = undefined;
    inFlight = [];
  }

  beforeAll(() => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    cleanupDb = createDb(databaseUrl);
    blockerDb = createDb(databaseUrl);
    newerDb = createDb(databaseUrl);
    staleDb = createDb(databaseUrl);
    monitorDb = createDb(databaseUrl);
  });

  beforeEach(async () => {
    subjectId = `ssf-concurrency-${randomUUID()}`;
    fixtureJtis = [];
    signalsByToken.clear();
    await seedIdentityUserFixtures(cleanupDb, [
      {
        id: subjectId,
        name: "SSF Concurrency",
        email: `${subjectId}@integration.test`,
      },
    ]);
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await Promise.all([cleanupDb, blockerDb, newerDb, staleDb, monitorDb].map((db) => closeDb(db)));
  });

  it("serializes reordered lifecycle SETs and suppresses stale state and socket effects", async () => {
    const initiallyDisabledAt = new Date("2026-08-28T19:00:00.000Z");
    await cleanupDb.insert(bidUserProfile).values({
      userId: subjectId,
      identityDisabledAt: initiallyDisabledAt,
      createdAt: initiallyDisabledAt,
      updatedAt: initiallyDisabledAt,
    });

    const newerJti = orderedJti(subjectId, 102, "newer-enable");
    const staleJti = orderedJti(subjectId, 101, "stale-disable");
    fixtureJtis.push(newerJti, staleJti);
    signalsByToken.set("newer", signal(subjectId, SSF_EVENT_TYPES.ACCOUNT_ENABLED, newerJti));
    signalsByToken.set("stale", signal(subjectId, SSF_EVENT_TYPES.ACCOUNT_DISABLED, staleJti));

    const publish = vi.fn().mockResolvedValue(1);
    const newerRoute = createBidSsfEventsRoute({
      replayStore: createBidSsfReplayStore(newerDb),
      issuer: "https://auth.test",
      jwksUrl: "https://auth.test/jwks",
      publish,
    });
    const staleRoute = createBidSsfEventsRoute({
      replayStore: createBidSsfReplayStore(staleDb),
      issuer: "https://auth.test",
      jwksUrl: "https://auth.test/jwks",
      publish,
    });

    const blockerReady = deferred();
    const releaseBlocker = deferred();
    releaseHeldLock = releaseBlocker.resolve;
    const blocker = blockerDb.transaction(async (tx) => {
      await tx
        .select({ userId: bidUserProfile.userId })
        .from(bidUserProfile)
        .where(eq(bidUserProfile.userId, subjectId))
        .for("update");
      blockerReady.resolve();
      await releaseBlocker.promise;
    });
    inFlight.push(blocker);
    await blockerReady.promise;

    const request = (
      route: ReturnType<typeof createBidSsfEventsRoute>,
      token: string,
    ): Promise<Response> =>
      Promise.resolve(
        route.request("/", {
          method: "POST",
          headers: { "content-type": "application/secevent+jwt" },
          body: token,
        }),
      );

    const newerRequest = request(newerRoute, "newer");
    inFlight.push(newerRequest);
    await waitForReceiverLockWaiters(1);
    const staleRequest = request(staleRoute, "stale");
    inFlight.push(staleRequest);
    await waitForReceiverLockWaiters(2);
    releaseBlocker.resolve();

    const [newerResponse, staleResponse] = await Promise.all([newerRequest, staleRequest]);
    expect(newerResponse.status).toBe(202);
    expect(staleResponse.status).toBe(202);

    const [profile] = await cleanupDb
      .select({ identityDisabledAt: bidUserProfile.identityDisabledAt })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, subjectId));
    expect(profile?.identityDisabledAt).toBeNull();
    expect(publish).not.toHaveBeenCalled();

    const replayRows = await cleanupDb
      .select({ jti: bidSsfReplay.jti })
      .from(bidSsfReplay)
      .where(inArray(bidSsfReplay.jti, fixtureJtis));
    expect(replayRows).toHaveLength(2);
  }, 15_000);

  it("keeps mixed-version legacy unordered enable fail-closed", async () => {
    const disabledAt = new Date("2026-08-28T19:00:00.000Z");
    await cleanupDb.insert(bidUserProfile).values({
      userId: subjectId,
      identityDisabledAt: disabledAt,
      createdAt: disabledAt,
      updatedAt: disabledAt,
    });
    const legacyJti = `legacy-${randomUUID()}`;
    fixtureJtis.push(legacyJti);
    signalsByToken.set(
      "legacy-enable",
      signal(subjectId, SSF_EVENT_TYPES.ACCOUNT_ENABLED, legacyJti),
    );
    const publish = vi.fn().mockResolvedValue(1);
    const route = createBidSsfEventsRoute({
      replayStore: createBidSsfReplayStore(newerDb),
      issuer: "https://auth.test",
      jwksUrl: "https://auth.test/jwks",
      publish,
    });

    const response = await route.request("/", {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: "legacy-enable",
    });

    expect(response.status).toBe(202);
    const [profile] = await cleanupDb
      .select({ identityDisabledAt: bidUserProfile.identityDisabledAt })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, subjectId));
    expect(profile?.identityDisabledAt?.getTime()).toBe(disabledAt.getTime());
    expect(publish).not.toHaveBeenCalled();

    const replayRows = await cleanupDb
      .select({ jti: bidSsfReplay.jti })
      .from(bidSsfReplay)
      .where(eq(bidSsfReplay.jti, legacyJti));
    expect(replayRows).toHaveLength(1);
  });
});
