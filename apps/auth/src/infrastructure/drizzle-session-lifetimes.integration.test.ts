import { randomUUID } from "node:crypto";
import { createDrizzleTwoFactorPolicyStore, createIdentityDb } from "@auction/identity-db";
import {
  identityAccessMarker,
  oauthAccessToken,
  oauthApplication,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
  session,
  sessionLineage,
  user,
} from "@auction/identity-db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { SignInLivenessGuard } from "../services/refresh-sign-in-guard.js";
import { SessionActivity } from "../services/session-activity.service.js";
import { SessionCap } from "../services/session-cap.service.js";
import { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";
import {
  SESSION_LIFETIME_POLICY,
  clampExpiry,
  sessionEndReason,
} from "../services/session-lifetime-policy.js";
import { SessionTakeoverService } from "../services/session-takeover.service.js";
import { hasStaffMarker } from "../services/staff-marker.js";
import { DrizzleRpLogoutRepository } from "./drizzle-backchannel-logout.adapters.js";
import { DrizzleSessionActivityStore } from "./drizzle-session-activity.store.js";
import { DrizzleSessionCapStore } from "./drizzle-session-cap.store.js";
import { DrizzleSessionExpiryClamp } from "./drizzle-session-expiry-clamp.js";
import { DrizzleSessionExpiryStore } from "./drizzle-session-expiry.store.js";
import { DrizzleSessionTakeoverStore } from "./drizzle-session-takeover.store.js";
import { DrizzleOidcRpSessionRepository } from "./oidc-session-adapters.js";
import { sessionHasEnded } from "./session-lifetime.sql.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const ANN = `sd3-${run}-ann`;
const STAFF = `sd3-${run}-staff`;
const ORG = `sd3-${run}-org`;
const PEOPLE = [ANN, STAFF, ORG];
const CLIENT = `sd3-${run}-bid`;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe.skipIf(!DATABASE_URL)("sign-in lifetimes and the browser cap, against Postgres", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const database = db as NonNullable<typeof db>;
  const now = new Date();
  const ago = (ms: number) => new Date(now.getTime() - ms);

  type Times = {
    expiresAt?: Date;
    lastSeenAt?: Date | null;
    updatedAt?: Date;
    signedInAt?: Date | null;
    createdAt?: Date;
  };

  /**
   * A record as the issuer leaves it: unless a test says otherwise, `expires_at` is a day ahead but
   * held to the person's idle and absolute limits, as the clamp does for every record it writes.
   */
  async function record(id: string, userId: string, times: Times = {}) {
    const createdAt = times.createdAt ?? ago(HOUR);
    const updatedAt = times.updatedAt ?? ago(HOUR);
    const lastSeenAt = times.lastSeenAt === undefined ? ago(HOUR) : times.lastSeenAt;
    const signedInAt = times.signedInAt === undefined ? ago(HOUR) : times.signedInAt;
    await database.insert(session).values({
      id,
      token: `tok-${id}`,
      userId,
      expiresAt:
        times.expiresAt ??
        clampExpiry(
          new Date(now.getTime() + DAY),
          { lastActiveAt: lastSeenAt ?? updatedAt, signedInAt: signedInAt ?? createdAt },
          userId === STAFF,
        ),
      createdAt,
      updatedAt,
      lastSeenAt,
      signedInAt,
    });
  }

  async function token(id: string, userId: string, sid: string) {
    await database.insert(oauthAccessToken).values({
      id,
      accessToken: `access-${id}`,
      refreshToken: `refresh-${id}`,
      accessTokenExpiresAt: new Date(now.getTime() + 600_000),
      refreshTokenExpiresAt: new Date(now.getTime() + 30 * DAY),
      clientId: CLIENT,
      userId,
      scopes: "openid",
      sid,
      createdAt: now,
      updatedAt: now,
    });
  }

  const idsOf = async (userId: string) =>
    (await database.select({ id: session.id }).from(session).where(eq(session.userId, userId)))
      .map((row) => row.id)
      .sort();

  const tokensOf = async (userId: string) =>
    (
      await database
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.userId, userId))
    )
      .map((row) => row.id)
      .sort();

  const lastSeenOf = async (id: string) =>
    (
      await database
        .select({ lastSeenAt: session.lastSeenAt })
        .from(session)
        .where(eq(session.id, id))
    )[0]?.lastSeenAt;

  async function clear() {
    await database.delete(session).where(inArray(session.userId, PEOPLE));
    await database.delete(oauthAccessToken).where(inArray(oauthAccessToken.userId, PEOPLE));
    await database.delete(oidcRpSession).where(inArray(oidcRpSession.subjectId, PEOPLE));
    await database
      .delete(oidcBackchannelLogoutDelivery)
      .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT));
  }

  beforeAll(async () => {
    if (!db) return;
    await database.insert(user).values(
      PEOPLE.map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await database.insert(identityAccessMarker).values([
      { subjectId: STAFF, kind: "staff", product: "bid" },
      { subjectId: ORG, kind: "org_member", legalEntityId: randomUUID() },
    ]);
    await database.insert(oauthApplication).values({
      id: `${CLIENT}-app`,
      name: CLIENT,
      clientId: CLIENT,
      redirectUrls: "https://example.test/callback",
      type: "web",
      backchannelLogoutUri: `https://${CLIENT}.example.test/backchannel-logout`,
      createdAt: now,
      updatedAt: now,
    });
  });
  beforeEach(clear);
  afterAll(async () => {
    if (!db) return;
    await clear();
    await database.delete(user).where(inArray(user.id, PEOPLE));
    await database.delete(oauthApplication).where(eq(oauthApplication.clientId, CLIENT));
  });

  /** The sweep, with back-channel logout made durable per record like the real one. */
  function sweep() {
    const logout = new BackchannelLogoutRevocationCoordinator(
      new DrizzleRpLogoutRepository(database),
    );
    const reserve = vi.fn(
      async ({ sessionIds }: { userId: string; sessionIds: readonly string[] }) => ({
        run: async () => {
          await logout.revokeIdentitySessions(sessionIds);
        },
      }),
    );
    return {
      reserve,
      sweep: new SessionExpirySweep(
        new DrizzleSessionExpiryStore(database, PEOPLE),
        { reserve },
        () => now,
      ),
    };
  }

  async function rpSession(userId: string, sid: string, identitySessionId: string) {
    await new DrizzleOidcRpSessionRepository(database).upsertRpSession({
      clientId: CLIENT,
      subjectId: userId,
      sid,
      identitySessionId,
      seenAt: now,
    });
  }

  const deliveredSids = async () =>
    (
      await database
        .select({ sid: oidcBackchannelLogoutDelivery.sid })
        .from(oidcBackchannelLogoutDelivery)
        .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT))
    )
      .map((row) => row.sid)
      .sort();

  describe("which records are over", () => {
    it("is the same in SQL as in the policy, for clients, staff and records without the newer columns", async () => {
      const ages = [
        0,
        HOUR,
        12 * HOUR - 1,
        12 * HOUR,
        24 * HOUR - 1,
        24 * HOUR,
        7 * DAY - 1,
        7 * DAY,
        30 * DAY - 1,
        30 * DAY,
        45 * DAY,
      ];
      const expected = new Map<string, boolean>();
      let n = 0;
      for (const userId of [ANN, STAFF, ORG]) {
        for (const idleFor of ages) {
          for (const signedInFor of ages) {
            for (const legacy of [false, true]) {
              const id = `m${n++}`;
              const times = {
                expiresAt: new Date(now.getTime() + 60 * DAY),
                lastSeenAt: legacy ? null : ago(idleFor),
                updatedAt: legacy ? ago(idleFor) : ago(60 * DAY),
                signedInAt: legacy ? null : ago(signedInFor),
                createdAt: legacy ? ago(signedInFor) : ago(60 * DAY),
              };
              await record(id, userId, times);
              expected.set(
                id,
                sessionEndReason(
                  {
                    expiresAt: times.expiresAt,
                    lastActiveAt: legacy ? times.updatedAt : (times.lastSeenAt as Date),
                    signedInAt: legacy ? times.createdAt : (times.signedInAt as Date),
                  },
                  userId === STAFF,
                  now,
                ) !== null,
              );
            }
          }
        }
      }
      await record("expired", ANN, { expiresAt: now });
      expected.set("expired", true);

      const ended = (
        await database
          .select({ id: session.id })
          .from(session)
          .where(and(inArray(session.userId, PEOPLE), sessionHasEnded(now)))
      ).map((row) => row.id);

      expect(new Set(ended)).toEqual(
        new Set([...expected].filter(([, over]) => over).map(([id]) => id)),
      );
    }, 120_000);

    it("reads the staff marker the way the existing role source does", async () => {
      const store = createDrizzleTwoFactorPolicyStore(database);
      for (const [userId, staff] of [
        [ANN, false],
        [STAFF, true],
        [ORG, false],
      ] as const) {
        await expect(hasStaffMarker({ twoFactorPolicyStore: store }, userId)).resolves.toBe(staff);
        await record(`parity-${userId}`, userId, {
          lastSeenAt: ago(13 * HOUR),
          updatedAt: ago(13 * HOUR),
        });
      }
      // Idle 13 hours: over for staff alone.
      const ended = (
        await database
          .select({ id: session.id })
          .from(session)
          .where(and(inArray(session.userId, PEOPLE), sessionHasEnded(now)))
      ).map((row) => row.id);
      expect(ended).toEqual([`parity-${STAFF}`]);
    });
  });

  describe("recording use (SD7 throttle)", () => {
    const store = () => new DrizzleSessionActivityStore(database);

    it("writes once per 15 minutes per record", async () => {
      await record("rec", ANN, { lastSeenAt: ago(3 * HOUR) });
      const throttle = SESSION_LIFETIME_POLICY.activityThrottleMs;
      const first = ago(2 * HOUR);

      await expect(store().touch("rec", first, throttle)).resolves.toBe(true);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(first.getTime());

      const soon = new Date(first.getTime() + throttle - 1);
      await expect(store().touch("rec", soon, throttle)).resolves.toBe(false);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(first.getTime());

      const later = new Date(first.getTime() + throttle);
      await expect(store().touch("rec", later, throttle)).resolves.toBe(true);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(later.getTime());
    });

    it("never writes a time later than the database's own clock, so a fast instance clock cannot stretch idleness", async () => {
      await record("rec", ANN, { lastSeenAt: ago(HOUR) });
      const dbBefore = Date.now();
      await expect(
        store().touch("rec", new Date(Date.now() + 30 * MINUTE), 15 * MINUTE),
      ).resolves.toBe(true);
      const stored = (await lastSeenOf("rec"))?.getTime() ?? Number.POSITIVE_INFINITY;
      expect(stored).toBeLessThanOrEqual(Date.now() + 1_000);
      expect(stored).toBeGreaterThanOrEqual(dbBefore - 1_000);
    });

    it("writes for a record that has never been stamped", async () => {
      await record("rec", ANN, { lastSeenAt: null });
      await expect(store().touch("rec", now, 15 * MINUTE)).resolves.toBe(true);
    });

    it("writes once when many instances note the same use at the same moment", async () => {
      await record("rec", ANN, { lastSeenAt: ago(HOUR) });
      const results = await Promise.all(
        Array.from({ length: 8 }, () => store().touch("rec", now, 15 * MINUTE)),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("never brings back a record that is already over, or touches one that is not there", async () => {
      const idleFor = ago(8 * DAY);
      await record("idle", ANN, { lastSeenAt: idleFor, updatedAt: idleFor });
      await record("old", ANN, { signedInAt: ago(31 * DAY) });
      await record("staff-idle", STAFF, { lastSeenAt: ago(13 * HOUR), updatedAt: ago(13 * HOUR) });

      for (const id of ["idle", "old", "staff-idle", "missing"]) {
        await expect(store().touch(id, now, 15 * MINUTE)).resolves.toBe(false);
      }
      expect((await lastSeenOf("idle"))?.getTime()).toBe(idleFor.getTime());
    });

    it("is what keeps a record from going idle", async () => {
      await record("rec", ANN, {
        lastSeenAt: ago(6 * DAY),
        updatedAt: ago(6 * DAY),
        expiresAt: new Date(now.getTime() + 30 * DAY),
      });
      const later = new Date(now.getTime() + 2 * DAY);
      await new SessionActivity(store(), () => now).record("rec");

      const ended = await database
        .select({ id: session.id })
        .from(session)
        .where(and(inArray(session.userId, PEOPLE), sessionHasEnded(later)));
      expect(ended).toEqual([]);
    });
  });

  describe("ending by idleness and age (SD7, SD8, SD9)", () => {
    it("ends a client idle for 7 days like a sign-out, and leaves one idle for 6", async () => {
      await record("idle", ANN, { lastSeenAt: ago(7 * DAY), updatedAt: ago(7 * DAY) });
      await record("busy", ANN, { lastSeenAt: ago(6 * DAY), updatedAt: ago(6 * DAY) });
      await record("idle-before-lineage", STAFF); // not ANN's: untouched below
      await database
        .insert(sessionLineage)
        .values({ previousSid: "idle-0", sessionId: "idle", userId: ANN, createdAt: now });
      await rpSession(ANN, "idle-0", "idle");
      await token("t-idle", ANN, "idle-0");
      await token("t-busy", ANN, "busy");

      const { sweep: sweeper, reserve } = sweep();
      await expect(sweeper.run()).resolves.toBe(1);

      expect(await idsOf(ANN)).toEqual(["busy"]);
      expect(await tokensOf(ANN)).toEqual(["t-busy"]);
      expect(await deliveredSids()).toEqual(["idle-0"]);
      expect(reserve).toHaveBeenCalledWith({ userId: ANN, sessionIds: ["idle", "idle-0"] });
    });

    it("counts a record's age from its last stamp, or for older records from its last renewal", async () => {
      await record("legacy-idle", ANN, {
        lastSeenAt: null,
        updatedAt: ago(8 * DAY),
        createdAt: ago(9 * DAY),
        signedInAt: null,
      });
      await record("legacy-busy", ANN, {
        lastSeenAt: null,
        updatedAt: ago(DAY),
        createdAt: ago(20 * DAY),
        signedInAt: null,
      });
      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(1);
      expect(await idsOf(ANN)).toEqual(["legacy-busy"]);
    });

    it("ends a client 30 days after first sign-in even though it was used a minute ago", async () => {
      await record("old", ANN, { signedInAt: ago(30 * DAY), lastSeenAt: ago(MINUTE) });
      await record("young", ANN, { signedInAt: ago(30 * DAY - MINUTE), lastSeenAt: ago(MINUTE) });
      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(1);
      expect(await idsOf(ANN)).toEqual(["young"]);
    });

    it("ends staff after 12 hours idle and after 24 hours in all, where a client is left alone", async () => {
      const idle = { lastSeenAt: ago(12 * HOUR), updatedAt: ago(12 * HOUR) };
      await record("staff-idle", STAFF, idle);
      await record("staff-old", STAFF, { signedInAt: ago(24 * HOUR), lastSeenAt: ago(MINUTE) });
      await record("staff-ok", STAFF, { signedInAt: ago(23 * HOUR), lastSeenAt: ago(11 * HOUR) });
      await record("client-same-ages", ANN, idle);
      await record("client-same-age-old", ANN, { signedInAt: ago(24 * HOUR) });
      await token("t-staff-idle", STAFF, "staff-idle");

      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(2);

      expect(await idsOf(STAFF)).toEqual(["staff-ok"]);
      expect(await idsOf(ANN)).toEqual(["client-same-age-old", "client-same-ages"]);
      expect(await tokensOf(STAFF)).toEqual([]);
    });

    it("treats a person with only an organisation marker as a client", async () => {
      await record("org-idle", ORG, { lastSeenAt: ago(13 * HOUR), updatedAt: ago(13 * HOUR) });
      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(0);
    });

    it("is idempotent", async () => {
      await record("idle", ANN, { lastSeenAt: ago(8 * DAY), updatedAt: ago(8 * DAY) });
      await rpSession(ANN, "idle", "idle");
      const { sweep: sweeper, reserve } = sweep();

      await expect(sweeper.run()).resolves.toBe(1);
      await expect(sweeper.run()).resolves.toBe(0);

      expect(reserve).toHaveBeenCalledOnce();
      expect(await deliveredSids()).toEqual(["idle"]);
    });

    it("hands each instance its own records when several sweep at once", async () => {
      for (const id of ["r1", "r2", "r3"]) {
        await record(id, ANN, { lastSeenAt: ago(8 * DAY), updatedAt: ago(8 * DAY) });
      }
      const store = new DrizzleSessionExpiryStore(database, PEOPLE);
      const first: string[] = [];
      const second: string[] = [];

      await store.endExpired(now, 1, async (batch) => {
        first.push(...batch.map((entry) => entry.id));
        // While the first instance holds its record, the second takes others, never that one.
        await store.endExpired(now, 10, async (other) => {
          second.push(...other.map((entry) => entry.id));
        });
      });

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(2);
      expect([...first, ...second].sort()).toEqual(["r1", "r2", "r3"]);
      expect(await idsOf(ANN)).toEqual([]);
    });

    it("deletes nothing when the durable write fails, and a later run takes the record", async () => {
      await record("idle", ANN, { lastSeenAt: ago(8 * DAY), updatedAt: ago(8 * DAY) });
      const store = new DrizzleSessionExpiryStore(database, PEOPLE);
      await expect(
        store.endExpired(now, 10, async () => {
          throw new Error("outbox down");
        }),
      ).rejects.toThrow("outbox down");
      expect(await idsOf(ANN)).toEqual(["idle"]);
      await expect(sweep().sweep.run()).resolves.toBe(1);
    });
  });

  describe("refresh after the sign-in has ended (SD7, SD8, SD9)", () => {
    const repository = () => new DrizzleOidcRpSessionRepository(database);
    const guard = () =>
      new SignInLivenessGuard({
        findLiveIdentitySession: (sid) => repository().findLiveIdentitySession(sid, now),
        peekContinuity: async () => null,
        recordActivity: (id) =>
          new SessionActivity(new DrizzleSessionActivityStore(database), () => now).record(id),
        onActivityFailed: () => undefined,
      });

    it("lets a live record refresh and counts it as use", async () => {
      await record("rec", ANN, { lastSeenAt: ago(3 * DAY), updatedAt: ago(3 * DAY) });
      await expect(guard().isLive({ userId: ANN, sid: "rec", refreshToken: "r" })).resolves.toBe(
        true,
      );
      expect((await lastSeenOf("rec"))?.getTime()).toBe(now.getTime());
    });

    it("refuses once the record is idle or past its age, before the sweep has taken it", async () => {
      await record("idle", ANN, { lastSeenAt: ago(7 * DAY), updatedAt: ago(7 * DAY) });
      await record("old", ANN, { signedInAt: ago(30 * DAY) });
      await record("staff-idle", STAFF, { lastSeenAt: ago(12 * HOUR), updatedAt: ago(12 * HOUR) });
      await record("staff-old", STAFF, { signedInAt: ago(24 * HOUR) });

      for (const [userId, sid] of [
        [ANN, "idle"],
        [ANN, "old"],
        [STAFF, "staff-idle"],
        [STAFF, "staff-old"],
      ] as const) {
        await expect(guard().isLive({ userId, sid, refreshToken: "r" })).resolves.toBe(false);
      }
      // Refusing is not use: nothing was stamped.
      expect((await lastSeenOf("idle"))?.getTime()).toBe(ago(7 * DAY).getTime());
    });

    it("refuses a name that now stands for a record that has ended", async () => {
      await record("rec", ANN, { signedInAt: ago(31 * DAY) });
      await database
        .insert(sessionLineage)
        .values({ previousSid: "rec-0", sessionId: "rec", userId: ANN, createdAt: now });
      await expect(guard().isLive({ userId: ANN, sid: "rec-0", refreshToken: "r" })).resolves.toBe(
        false,
      );
    });
  });

  describe("the original sign-in time survives renewals (SD8)", () => {
    const takeover = () =>
      new SessionTakeoverService(
        new DrizzleSessionTakeoverStore(database),
        { reserve: async () => ({ run: async () => undefined }) },
        { enforce: async () => 0 },
        () => now,
      );

    async function signInAgain(newId: string, previousId: string) {
      await record(newId, ANN, { signedInAt: null, lastSeenAt: null, createdAt: now });
      await takeover().takeOver({
        newSessionId: newId,
        previousSessionId: previousId,
        deviceHash: null,
        country: null,
      });
    }

    const signedInAtOf = async (id: string) =>
      (
        await database
          .select({ signedInAt: session.signedInAt })
          .from(session)
          .where(eq(session.id, id))
      )[0]?.signedInAt;

    it("carries the first sign-in time through each renewal, so a client still ends 30 days after it", async () => {
      const first = ago(29 * DAY);
      await record("gen-1", ANN, { signedInAt: first, createdAt: first });
      await signInAgain("gen-2", "gen-1");
      await signInAgain("gen-3", "gen-2");

      expect((await signedInAtOf("gen-3"))?.getTime()).toBe(first.getTime());
      expect(await idsOf(ANN)).toEqual(["gen-3"]);

      // A day later the renewed record is over, although it was created just now.
      const tomorrow = new Date(now.getTime() + DAY);
      const ended = await database
        .select({ id: session.id })
        .from(session)
        .where(and(inArray(session.userId, PEOPLE), sessionHasEnded(tomorrow)));
      expect(ended).toEqual([{ id: "gen-3" }]);
    });

    it("does the same for staff on the 24-hour limit, and a first sign-in starts its own clock", async () => {
      await record("staff-1", STAFF, { signedInAt: ago(23 * HOUR), createdAt: ago(23 * HOUR) });
      await record("staff-2", STAFF, { signedInAt: null, lastSeenAt: null, createdAt: now });
      await new SessionTakeoverService(
        new DrizzleSessionTakeoverStore(database),
        { reserve: async () => ({ run: async () => undefined }) },
        { enforce: async () => 0 },
        () => now,
      ).takeOver({
        newSessionId: "staff-2",
        previousSessionId: "staff-1",
        deviceHash: null,
        country: null,
      });
      expect((await signedInAtOf("staff-2"))?.getTime()).toBe(ago(23 * HOUR).getTime());

      const inTwoHours = new Date(now.getTime() + 2 * HOUR);
      const ended = await database
        .select({ id: session.id })
        .from(session)
        .where(and(inArray(session.userId, PEOPLE), sessionHasEnded(inTwoHours)));
      expect(ended).toEqual([{ id: "staff-2" }]);
    });
  });

  describe("signing in again over a record that is already over", () => {
    const takeover = () =>
      new SessionTakeoverService(
        new DrizzleSessionTakeoverStore(database),
        { reserve: async () => ({ run: async () => undefined }) },
        { enforce: async () => 0 },
        () => now,
      );

    it("gives a live record with a fresh sign-in time, and leaves the over record and its sids to the sweep", async () => {
      // Over its 30 days, but Better Auth renewed expires_at, so it is not yet swept.
      const old = ago(31 * DAY);
      await record("over-1", ANN, { signedInAt: old, createdAt: old, lastSeenAt: ago(HOUR) });
      await rpSession(ANN, "product-sid", "over-1");
      for (const [newId, previousId] of [
        ["over-new1", "over-1"],
        ["over-new2", "over-new1"],
        ["over-new3", "over-new2"],
      ] as const) {
        await record(newId, ANN, { signedInAt: null, lastSeenAt: null, createdAt: now });
        await takeover().takeOver({
          newSessionId: newId,
          previousSessionId: previousId,
          deviceHash: null,
          country: null,
        });
      }

      const rows = await database
        .select({ id: session.id, signedInAt: session.signedInAt })
        .from(session)
        .where(eq(session.userId, ANN));
      const fresh = rows.filter((row) => row.id.startsWith("over-new"));
      expect(fresh.map((row) => [row.id, row.signedInAt?.getTime()])).toEqual([
        ["over-new3", now.getTime()],
      ]);
      const live = await database
        .select({ id: session.id })
        .from(session)
        .where(sql`${session.userId} = ${ANN} AND NOT ${sessionHasEnded(now)}`);
      expect(live.map((row) => row.id).sort()).toEqual(["over-new3"]);
      // The product session stays on the over record: it is not re-bound to a live one.
      const [rp] = await database
        .select({ identitySessionId: oidcRpSession.identitySessionId })
        .from(oidcRpSession)
        .where(eq(oidcRpSession.sid, "product-sid"));
      expect(rp?.identitySessionId).toBe("over-1");
      expect(
        await database
          .select()
          .from(sessionLineage)
          .where(eq(sessionLineage.previousSid, "over-1")),
      ).toEqual([]);
      // The sweep still ends the over record, with its product sid.
      const { sweep: sweeper, reserve } = sweep();
      await sweeper.run();
      expect(await idsOf(ANN)).not.toContain("over-1");
      expect(reserve).toHaveBeenCalledWith(
        expect.objectContaining({ sessionIds: expect.arrayContaining(["over-1"]) }),
      );
    });

    it("still ends another person's record named by the session cookie, even when it is over", async () => {
      const old = ago(31 * DAY);
      await record("other-over", ORG, { signedInAt: old, createdAt: old });
      await record("ann-new", ANN, { signedInAt: null, lastSeenAt: null, createdAt: now });
      await takeover().takeOver({
        newSessionId: "ann-new",
        previousSessionId: "other-over",
        deviceHash: null,
        country: null,
      });
      expect(await idsOf(ORG)).toEqual([]);
      const [fresh] = await database
        .select({ signedInAt: session.signedInAt })
        .from(session)
        .where(eq(session.id, "ann-new"));
      expect(fresh?.signedInAt?.getTime()).toBe(now.getTime());
    });
  });

  describe("the issuer holds expires_at to the person's limits", () => {
    const clamp = () => new DrizzleSessionExpiryClamp(database, () => now);
    const week = new Date(now.getTime() + 7 * DAY);
    const expiresOf = async (id: string) =>
      (
        await database
          .select({ expiresAt: session.expiresAt })
          .from(session)
          .where(eq(session.id, id))
      )[0]?.expiresAt;

    it("starts a new client's clocks now and a new staff member's too", async () => {
      expect(
        (await clamp().clamp({ userId: ANN, sessionId: null, expiresAt: week })).getTime(),
      ).toBe(week.getTime());
      expect(
        (await clamp().clamp({ userId: STAFF, sessionId: null, expiresAt: week })).getTime(),
      ).toBe(now.getTime() + 12 * HOUR);
      expect(
        (await clamp().clamp({ userId: ORG, sessionId: null, expiresAt: week })).getTime(),
      ).toBe(week.getTime());
    });

    it("refuses to renew a client past 30 days from first sign-in, or a staff record past 24 hours or 12 idle", async () => {
      await record("ann-old", ANN, { signedInAt: ago(29 * DAY), createdAt: ago(29 * DAY) });
      await record("staff-day", STAFF, { signedInAt: ago(23 * HOUR), lastSeenAt: ago(MINUTE) });
      await record("staff-idle", STAFF, { lastSeenAt: ago(11 * HOUR), updatedAt: ago(11 * HOUR) });
      expect(
        (await clamp().clamp({ userId: ANN, sessionId: "ann-old", expiresAt: week })).getTime(),
      ).toBe(ago(29 * DAY).getTime() + 30 * DAY);
      expect(
        (await clamp().clamp({ userId: STAFF, sessionId: "staff-day", expiresAt: week })).getTime(),
      ).toBe(ago(23 * HOUR).getTime() + 24 * HOUR);
      expect(
        (
          await clamp().clamp({ userId: STAFF, sessionId: "staff-idle", expiresAt: week })
        ).getTime(),
      ).toBe(ago(11 * HOUR).getTime() + 12 * HOUR);
    });

    it("renews a record already past a limit to a time that has passed, so Better Auth refuses it", async () => {
      await record("ann-over", ANN, { signedInAt: ago(31 * DAY), createdAt: ago(31 * DAY) });
      await record("staff-over", STAFF, { signedInAt: ago(25 * HOUR), lastSeenAt: ago(MINUTE) });
      for (const [userId, sessionId] of [
        [ANN, "ann-over"],
        [STAFF, "staff-over"],
      ] as const) {
        const renewed = await clamp().clamp({ userId, sessionId, expiresAt: week });
        expect(renewed.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    });

    it("never extends what Better Auth proposed", async () => {
      await record("ann-new", ANN, {});
      const soon = new Date(now.getTime() + HOUR);
      expect(
        (await clamp().clamp({ userId: ANN, sessionId: "ann-new", expiresAt: soon })).getTime(),
      ).toBe(soon.getTime());
    });

    it("clamps the record a takeover stamps with the carried first sign-in time", async () => {
      await record("t-old", ANN, {
        signedInAt: ago(29 * DAY + 23 * HOUR),
        createdAt: ago(30 * DAY),
      });
      await record("t-new", ANN, {
        signedInAt: null,
        lastSeenAt: null,
        createdAt: now,
        expiresAt: week,
      });
      await new SessionTakeoverService(
        new DrizzleSessionTakeoverStore(database),
        { reserve: async () => ({ run: async () => undefined }) },
        { enforce: async () => 0 },
        () => now,
      ).takeOver({
        newSessionId: "t-new",
        previousSessionId: "t-old",
        deviceHash: null,
        country: null,
      });
      // One hour left of the 30 days, not seven days.
      expect((await expiresOf("t-new"))?.getTime()).toBe(now.getTime() + HOUR);
    });

    it("lets a staff takeover keep at most what is left of its 24 hours", async () => {
      await record("s-old", STAFF, { signedInAt: ago(20 * HOUR), createdAt: ago(20 * HOUR) });
      await record("s-new", STAFF, {
        signedInAt: null,
        lastSeenAt: null,
        createdAt: now,
        expiresAt: week,
      });
      await new SessionTakeoverService(
        new DrizzleSessionTakeoverStore(database),
        { reserve: async () => ({ run: async () => undefined }) },
        { enforce: async () => 0 },
        () => now,
      ).takeOver({
        newSessionId: "s-new",
        previousSessionId: "s-old",
        deviceHash: null,
        country: null,
      });
      expect((await expiresOf("s-new"))?.getTime()).toBe(now.getTime() + 4 * HOUR);
    });
  });

  describe("the browser cap (SD10)", () => {
    function cap(effects: { run: () => Promise<void> } = { run: async () => undefined }) {
      const reserve = vi.fn(
        async ({ sessionIds }: { userId: string; sessionIds: readonly string[] }) => ({
          run: async () => {
            await new BackchannelLogoutRevocationCoordinator(
              new DrizzleRpLogoutRepository(database),
            ).revokeIdentitySessions(sessionIds);
            await effects.run();
          },
        }),
      );
      return {
        reserve,
        cap: new SessionCap(new DrizzleSessionCapStore(database), { reserve }, () => now),
      };
    }

    /** `count` records for the person; `s00` is the least recently used, the last is the newest. */
    async function fill(userId: string, count: number) {
      for (let i = 0; i < count; i++) {
        const id = `${userId}-s${String(i).padStart(2, "0")}`;
        await record(id, userId, { lastSeenAt: ago((count - i) * MINUTE), updatedAt: ago(DAY) });
      }
      return (i: number) => `${userId}-s${String(i).padStart(2, "0")}`;
    }

    it("does nothing at 20 browsers", async () => {
      const id = await fill(ANN, 20);
      const { cap: capped, reserve } = cap();
      await expect(capped.enforce({ userId: ANN, keepSessionId: id(19) })).resolves.toBe(0);
      expect(await idsOf(ANN)).toHaveLength(20);
      expect(reserve).not.toHaveBeenCalled();
    });

    it("ends the least recently used record on the 21st, with back-channel logout and its tokens", async () => {
      const id = await fill(ANN, 21);
      await database
        .insert(sessionLineage)
        .values({ previousSid: "s00-before", sessionId: id(0), userId: ANN, createdAt: now });
      await rpSession(ANN, "s00-before", id(0));
      await rpSession(ANN, id(1), id(1));
      await token("t-evicted", ANN, "s00-before");
      await token("t-kept", ANN, id(1));
      const { cap: capped, reserve } = cap();

      await expect(capped.enforce({ userId: ANN, keepSessionId: id(20) })).resolves.toBe(1);

      expect(await idsOf(ANN)).toEqual(Array.from({ length: 20 }, (_, i) => id(i + 1)));
      expect(await tokensOf(ANN)).toEqual(["t-kept"]);
      expect(reserve).toHaveBeenCalledExactlyOnceWith({
        userId: ANN,
        sessionIds: [id(0), "s00-before"],
      });
      expect(await deliveredSids()).toEqual(["s00-before"]);
      const lineage = await database
        .select({ previousSid: sessionLineage.previousSid })
        .from(sessionLineage)
        .where(eq(sessionLineage.userId, ANN));
      expect(lineage).toEqual([]);
    });

    it("never ends the new sign-in, even when its record looks the least recently used", async () => {
      const id = await fill(ANN, 21);
      // Still signed in, but unused for longer than any other.
      await database
        .update(session)
        .set({ lastSeenAt: ago(6 * DAY) })
        .where(eq(session.id, id(20)));
      const { cap: capped } = cap();

      await capped.enforce({ userId: ANN, keepSessionId: id(20) });

      expect(await idsOf(ANN)).toContain(id(20));
      expect(await idsOf(ANN)).not.toContain(id(0));
      expect(await idsOf(ANN)).toHaveLength(20);
    });

    it("ends the oldest several in order when a person is several over", async () => {
      const id = await fill(ANN, 23);
      const { cap: capped } = cap();
      await expect(capped.enforce({ userId: ANN, keepSessionId: id(22) })).resolves.toBe(3);
      expect(await idsOf(ANN)).toEqual(Array.from({ length: 20 }, (_, i) => id(i + 3)));
    });

    it("holds staff to 5 browsers", async () => {
      const id = await fill(STAFF, 6);
      const { cap: capped } = cap();
      await expect(capped.enforce({ userId: STAFF, keepSessionId: id(5) })).resolves.toBe(1);
      expect(await idsOf(STAFF)).toEqual([1, 2, 3, 4, 5].map(id));

      await expect(capped.enforce({ userId: STAFF, keepSessionId: id(5) })).resolves.toBe(0);
    });

    it("does not hold a person with only an organisation marker to the staff cap", async () => {
      const id = await fill(ORG, 6);
      const { cap: capped } = cap();
      await expect(capped.enforce({ userId: ORG, keepSessionId: id(5) })).resolves.toBe(0);
    });

    it("does not count records that are already over; the sweep ends those", async () => {
      const id = await fill(ANN, 20);
      for (let i = 0; i < 4; i++) {
        await record(`stale-${i}`, ANN, { expiresAt: ago(1), lastSeenAt: ago(40 * DAY) });
      }
      const { cap: capped } = cap();
      await expect(capped.enforce({ userId: ANN, keepSessionId: id(19) })).resolves.toBe(0);
      expect(await idsOf(ANN)).toHaveLength(24);
    });

    it("finds a person over their cap and ends the excess from the sweep's safety net, with the new sign-in not mattering", async () => {
      await fill(ANN, 22);
      await fill(STAFF, 5);
      await fill(ORG, 20);
      const { cap: capped } = cap();
      const store = new DrizzleSessionCapStore(database);
      const over = (await store.findOverCap(1000)).filter((id) => PEOPLE.includes(id));
      expect(over).toEqual([ANN]);
      // enforceOverCap looks at everyone; only this test's people are asserted on.
      await capped.enforceOverCap();
      expect(await idsOf(ANN)).toHaveLength(20);
      expect(await idsOf(ANN)).not.toContain(`${ANN}-s00`);
      expect(await idsOf(STAFF)).toHaveLength(5);
    });

    it("reports a person whose cap cannot be enforced and carries on with the rest", async () => {
      await fill(ANN, 21);
      await fill(STAFF, 6);
      const onFailed = vi.fn();
      let calls = 0;
      const store = new DrizzleSessionCapStore(database);
      const flaky = new SessionCap(
        {
          findOverCap: async () => [ANN, STAFF],
          endChosen: (userId, choose, beforeDelete) => {
            calls++;
            if (userId === ANN) throw new Error("deadlock detected");
            return store.endChosen(userId, choose, beforeDelete);
          },
        },
        { reserve: async () => ({ run: async () => undefined }) },
        () => now,
        onFailed,
      );
      await expect(flaky.enforceOverCap()).resolves.toBe(1);
      expect(calls).toBe(2);
      expect(onFailed).toHaveBeenCalledWith(expect.any(Error), ANN);
      expect(await idsOf(ANN)).toHaveLength(21);
      expect(await idsOf(STAFF)).toHaveLength(5);
    });

    it("a sign-in and a cap check of the same person at once never deadlock", async () => {
      await fill(ANN, 20);
      const { cap: capped } = cap();
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, async (_, i) => {
          const newId = `${ANN}-race-${i}`;
          await record(newId, ANN, {
            signedInAt: null,
            lastSeenAt: null,
            createdAt: now,
            updatedAt: now,
          });
          return Promise.all([
            new SessionTakeoverService(
              new DrizzleSessionTakeoverStore(database),
              { reserve: async () => ({ run: async () => undefined }) },
              capped,
              () => now,
            ).takeOver({
              newSessionId: newId,
              previousSessionId: `${ANN}-s0${i % 10}`,
              deviceHash: null,
              country: null,
            }),
            capped.enforce({ userId: ANN, keepSessionId: newId }),
          ]);
        }),
      );
      expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    });

    it("leaves another person's records alone", async () => {
      const ann = await fill(ANN, 21);
      const staff = await fill(STAFF, 5);
      const { cap: capped } = cap();
      await capped.enforce({ userId: ANN, keepSessionId: ann(20) });
      expect(await idsOf(STAFF)).toEqual([0, 1, 2, 3, 4].map(staff));
    });

    it("ends nothing when the durable write fails, and the next sign-in tries again", async () => {
      const id = await fill(ANN, 21);
      const failing = new SessionCap(
        new DrizzleSessionCapStore(database),
        {
          reserve: async () => {
            throw new Error("outbox down");
          },
        },
        () => now,
      );
      await expect(failing.enforce({ userId: ANN, keepSessionId: id(20) })).rejects.toThrow(
        "outbox down",
      );
      expect(await idsOf(ANN)).toHaveLength(21);

      await expect(cap().cap.enforce({ userId: ANN, keepSessionId: id(20) })).resolves.toBe(1);
    });

    it("keeps a person at the cap when two sign-ins of theirs finish at the same moment", async () => {
      const id = await fill(ANN, 22);
      const { cap: capped } = cap();
      const ended = await Promise.all([
        capped.enforce({ userId: ANN, keepSessionId: id(20) }),
        capped.enforce({ userId: ANN, keepSessionId: id(21) }),
      ]);
      expect(ended.reduce((sum, n) => sum + n, 0)).toBe(2);
      expect(await idsOf(ANN)).toEqual(
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(id),
      );
    });
  });

  it("has the indexes the sweep reads, and none on last use (it would stop touches being HOT)", async () => {
    const { rows } = await database.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'session' AND indexname IN ('session_last_active_idx', 'session_signed_in_idx', 'session_expires_at_id_idx')`,
    );
    expect(rows.map((r) => r.indexname).sort()).toEqual([
      "session_expires_at_id_idx",
      "session_signed_in_idx",
    ]);
  });
});
