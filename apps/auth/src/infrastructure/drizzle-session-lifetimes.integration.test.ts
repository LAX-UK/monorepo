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
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { SignInLivenessGuard } from "../services/refresh-sign-in-guard.js";
import { SessionActivity } from "../services/session-activity.service.js";
import { SessionCap } from "../services/session-cap.service.js";
import { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";
import { SESSION_LIFETIME_POLICY, sessionEndReason } from "../services/session-lifetime-policy.js";
import { SessionTakeoverService } from "../services/session-takeover.service.js";
import { hasStaffMarker } from "../services/staff-marker.js";
import { DrizzleRpLogoutRepository } from "./drizzle-backchannel-logout.adapters.js";
import { DrizzleSessionActivityStore } from "./drizzle-session-activity.store.js";
import { DrizzleSessionCapStore } from "./drizzle-session-cap.store.js";
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

  async function record(id: string, userId: string, times: Times = {}) {
    await database.insert(session).values({
      id,
      token: `tok-${id}`,
      userId,
      expiresAt: times.expiresAt ?? new Date(now.getTime() + DAY),
      createdAt: times.createdAt ?? ago(HOUR),
      updatedAt: times.updatedAt ?? ago(HOUR),
      lastSeenAt: times.lastSeenAt === undefined ? ago(HOUR) : times.lastSeenAt,
      signedInAt: times.signedInAt === undefined ? ago(HOUR) : times.signedInAt,
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
        new DrizzleSessionExpiryStore(database),
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
        await database.select({ id: session.id }).from(session).where(sessionHasEnded(now))
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
        await database.select({ id: session.id }).from(session).where(sessionHasEnded(now))
      ).map((row) => row.id);
      expect(ended).toEqual([`parity-${STAFF}`]);
    });
  });

  describe("recording use (SD7 throttle)", () => {
    const store = () => new DrizzleSessionActivityStore(database);

    it("writes once per 15 minutes per record", async () => {
      await record("rec", ANN, { lastSeenAt: ago(HOUR) });
      const throttle = SESSION_LIFETIME_POLICY.activityThrottleMs;

      await expect(store().touch("rec", now, throttle)).resolves.toBe(true);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(now.getTime());

      const soon = new Date(now.getTime() + throttle - 1);
      await expect(store().touch("rec", soon, throttle)).resolves.toBe(false);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(now.getTime());

      const later = new Date(now.getTime() + throttle);
      await expect(store().touch("rec", later, throttle)).resolves.toBe(true);
      expect((await lastSeenOf("rec"))?.getTime()).toBe(later.getTime());
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
        .where(sessionHasEnded(later));
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
      const store = new DrizzleSessionExpiryStore(database);
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
      const store = new DrizzleSessionExpiryStore(database);
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
        .where(sessionHasEnded(tomorrow));
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
        .where(sessionHasEnded(inTwoHours));
      expect(ended).toEqual([{ id: "staff-2" }]);
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

  it("has the indexes the sweep reads", async () => {
    const { rows } = await database.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'session' AND indexname IN ('session_last_active_idx', 'session_signed_in_idx')`,
    );
    expect(rows.map((r) => r.indexname).sort()).toEqual([
      "session_last_active_idx",
      "session_signed_in_idx",
    ]);
  });
});
