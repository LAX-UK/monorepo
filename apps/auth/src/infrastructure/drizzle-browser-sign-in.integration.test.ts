import { randomUUID } from "node:crypto";
import { createIdentityDb } from "@auction/identity-db";
import {
  oauthAccessToken,
  oauthApplication,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
  session,
  sessionLineage,
  user,
} from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { BrowserSignOutService } from "../services/browser-sign-out.service.js";
import { hashRefreshToken } from "../services/refresh-token-family.ports.js";
import { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";
import { DrizzleRpLogoutRepository } from "./drizzle-backchannel-logout.adapters.js";
import { DrizzleBrowserSignOutStore } from "./drizzle-browser-sign-out.store.js";
import { DrizzleOAuthTokenSignInStore } from "./drizzle-oauth-token-sign-in.store.js";
import { DrizzleRefreshTokenFamilyRepository } from "./drizzle-refresh-token-family-repository.js";
import { DrizzleSessionExpiryStore } from "./drizzle-session-expiry.store.js";
import { DrizzleSessionTakeoverStore } from "./drizzle-session-takeover.store.js";
import { DrizzleOidcRpSessionRepository } from "./oidc-session-adapters.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const ANN = `sd2-${run}-ann`;
const BEN = `sd2-${run}-ben`;
const CLIENTS = [`sd2-${run}-bid`, `sd2-${run}-shop`];
const DAY = 86_400_000;

describe.skipIf(!DATABASE_URL)("ending one browser's sign-in, against Postgres", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const database = db as NonNullable<typeof db>;
  const now = new Date();

  const tokensOf = async (userId: string) =>
    (
      await database
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.userId, userId))
    )
      .map((row) => row.id)
      .sort();

  async function record(id: string, userId: string, expiresAt = new Date(now.getTime() + DAY)) {
    await database.insert(session).values({
      id,
      token: `tok-${id}`,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function token(id: string, userId: string, clientId: string, sid: string | null) {
    await database.insert(oauthAccessToken).values({
      id,
      accessToken: `access-${id}`,
      refreshToken: `refresh-${id}`,
      accessTokenExpiresAt: new Date(now.getTime() + 600_000),
      refreshTokenExpiresAt: new Date(now.getTime() + 30 * DAY),
      clientId,
      userId,
      scopes: "openid",
      sid,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function clear() {
    await database.delete(session).where(inArray(session.userId, [ANN, BEN]));
    await database.delete(oauthAccessToken).where(inArray(oauthAccessToken.userId, [ANN, BEN]));
    await database.delete(oidcRpSession).where(inArray(oidcRpSession.subjectId, [ANN, BEN]));
    await database
      .delete(oidcBackchannelLogoutDelivery)
      .where(inArray(oidcBackchannelLogoutDelivery.clientId, CLIENTS));
  }

  beforeAll(async () => {
    if (!db) return;
    await database.insert(user).values(
      [ANN, BEN].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await database.insert(oauthApplication).values(
      CLIENTS.map((clientId) => ({
        id: `${clientId}-app`,
        name: clientId,
        clientId,
        redirectUrls: "https://example.test/callback",
        type: "web",
        backchannelLogoutUri: `https://${clientId}.example.test/backchannel-logout`,
        createdAt: now,
        updatedAt: now,
      })),
    );
  });
  beforeEach(clear);
  afterAll(async () => {
    if (!db) return;
    await clear();
    await database.delete(user).where(inArray(user.id, [ANN, BEN]));
    await database.delete(oauthApplication).where(inArray(oauthApplication.clientId, CLIENTS));
  });

  function signOutService() {
    const logout = new BackchannelLogoutRevocationCoordinator(
      new DrizzleRpLogoutRepository(database),
    );
    return new BrowserSignOutService(
      new DrizzleBrowserSignOutStore(database),
      logout,
      async () => undefined,
    );
  }

  async function rpSession(
    clientId: string,
    userId: string,
    sid: string,
    identitySessionId: string,
  ) {
    await new DrizzleOidcRpSessionRepository(database).upsertRpSession({
      clientId,
      subjectId: userId,
      sid,
      identitySessionId,
      seenAt: now,
    });
  }

  it("F2: ending one device's sign-in deletes only the tokens issued under it", async () => {
    await record("a-rec", ANN);
    await record("b-rec", ANN);
    await record("ben-rec", BEN);
    await database
      .insert(sessionLineage)
      .values({ previousSid: "a-old", sessionId: "a-rec", userId: ANN, createdAt: now });
    await token("t-a-new", ANN, CLIENTS[0] as string, "a-rec");
    await token("t-a-old", ANN, CLIENTS[1] as string, "a-old");
    await token("t-b", ANN, CLIENTS[0] as string, "b-rec");
    await token("t-b-shop", ANN, CLIENTS[1] as string, "b-rec");
    await token("t-legacy", ANN, CLIENTS[0] as string, null);
    await token("t-ben", BEN, CLIENTS[0] as string, "ben-rec");

    const names = await signOutService().namesOf({ subjectId: ANN, sessionId: "a-rec" });
    await new DrizzleBrowserSignOutStore(database).deleteTokensIssuedUnder(ANN, names);

    expect(names).toEqual(["a-rec", "a-old"]);
    expect(await tokensOf(ANN)).toEqual(["t-b", "t-b-shop", "t-legacy"]);
    expect(await tokensOf(BEN)).toEqual(["t-ben"]);
  });

  it("never matches another person's lineage", async () => {
    await record("a-rec", ANN);
    await database
      .insert(sessionLineage)
      .values({ previousSid: "a-old", sessionId: "a-rec", userId: ANN, createdAt: now });
    const store = new DrizzleBrowserSignOutStore(database);

    await expect(store.earlierNames("a-rec", ANN)).resolves.toEqual(["a-old"]);
    await expect(store.earlierNames("a-rec", BEN)).resolves.toEqual([]);
  });

  it("sends back-channel logout for the record and each earlier id, and for no other sign-in", async () => {
    await record("a-rec", ANN);
    await record("b-rec", ANN);
    await database
      .insert(sessionLineage)
      .values({ previousSid: "a-old", sessionId: "a-rec", userId: ANN, createdAt: now });
    await rpSession(CLIENTS[0] as string, ANN, "a-old", "a-rec");
    await rpSession(CLIENTS[1] as string, ANN, "a-rec", "a-rec");
    await rpSession(CLIENTS[0] as string, ANN, "b-rec", "b-rec");

    const response = await signOutService().end(
      { subjectId: ANN, sessionId: "a-rec" },
      async () => {
        await database.delete(session).where(eq(session.id, "a-rec"));
        return new Response("{}");
      },
    );

    expect(response.ok).toBe(true);
    const deliveries = await database
      .select({
        clientId: oidcBackchannelLogoutDelivery.clientId,
        sid: oidcBackchannelLogoutDelivery.sid,
      })
      .from(oidcBackchannelLogoutDelivery)
      .where(inArray(oidcBackchannelLogoutDelivery.clientId, CLIENTS));
    expect(deliveries.map((row) => `${row.clientId}:${row.sid}`).sort()).toEqual(
      [`${CLIENTS[0]}:a-old`, `${CLIENTS[1]}:a-rec`].sort(),
    );
    const [other] = await database
      .select({ revokedAt: oidcRpSession.revokedAt })
      .from(oidcRpSession)
      .where(eq(oidcRpSession.sid, "b-rec"));
    expect(other?.revokedAt).toBeNull();
  });

  describe("the 20-name cap on earlier ids", () => {
    it("moves tokens under a name that falls off the list to the record, so sign-out still finds them", async () => {
      await record("rec-new", ANN);
      await record("rec-mid", ANN);
      await database.insert(sessionLineage).values([
        {
          previousSid: "n-old",
          sessionId: "rec-new",
          userId: ANN,
          createdAt: new Date(now.getTime() - 3000),
        },
        {
          previousSid: "n-new",
          sessionId: "rec-new",
          userId: ANN,
          createdAt: new Date(now.getTime() - 1000),
        },
      ]);
      await token("t-evicted", ANN, CLIENTS[0] as string, "n-old");
      await token("t-kept", ANN, CLIENTS[0] as string, "n-new");
      await token("t-ben", BEN, CLIENTS[0] as string, "n-old");

      await new DrizzleSessionTakeoverStore(database).replace({
        newSessionId: "rec-new",
        userId: ANN,
        deviceHash: null,
        country: null,
        maxLineage: 2,
        now,
        sameSubject: [{ id: "rec-mid", userId: ANN, signedInAt: now, previousSids: [] }],
        otherSubject: [],
        signedInAt: now,
      });

      const names = await new DrizzleBrowserSignOutStore(database).earlierNames("rec-new", ANN);
      expect(names.sort()).toEqual(["n-new", "rec-mid"]);
      const sids = await database
        .select({ id: oauthAccessToken.id, sid: oauthAccessToken.sid })
        .from(oauthAccessToken)
        .where(inArray(oauthAccessToken.userId, [ANN, BEN]));
      expect(Object.fromEntries(sids.map((row) => [row.id, row.sid]))).toEqual({
        "t-evicted": "rec-new",
        "t-kept": "n-new",
        "t-ben": "n-old",
      });
    });
  });

  describe("refresh families", () => {
    it("reads the sign-in off the token and passes it to the successor", async () => {
      await record("a-rec", ANN);
      await token("t-1", ANN, CLIENTS[0] as string, "a-old");
      await token("t-2", ANN, CLIENTS[0] as string, null);
      const families = new DrizzleRefreshTokenFamilyRepository(database);

      const found = await families.findAndPrepare("refresh-t-1");
      expect(found?.sid).toBe("a-old");
      await families.completeRotation({
        consumedTokenId: "t-1",
        newRawToken: "refresh-t-2",
        familyId: found?.familyId ?? "",
      });

      const [successor] = await database
        .select({ sid: oauthAccessToken.sid })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.id, "t-2"));
      expect(successor?.sid).toBe("a-old");
    });

    it("leaves no successor behind when a sign-out deleted the token it replaces mid-refresh", async () => {
      await record("a-rec", ANN);
      await token("t-1", ANN, CLIENTS[0] as string, "a-rec");
      // Better Auth has inserted the successor, which has no sign-in recorded yet.
      await token("t-2", ANN, CLIENTS[0] as string, null);
      const families = new DrizzleRefreshTokenFamilyRepository(database);
      const found = await families.findAndPrepare("refresh-t-1");

      await new DrizzleBrowserSignOutStore(database).deleteTokensIssuedUnder(ANN, ["a-rec"]);
      await expect(
        families.completeRotation({
          consumedTokenId: "t-1",
          newRawToken: "refresh-t-2",
          familyId: found?.familyId ?? "",
        }),
      ).rejects.toThrow();

      expect(await tokensOf(ANN)).toEqual([]);
    });

    it("deleteFamilyTokens leaves the person's records and other tokens", async () => {
      await record("a-rec", ANN);
      await token("t-1", ANN, CLIENTS[0] as string, "a-rec");
      await token("t-2", ANN, CLIENTS[1] as string, "a-rec");
      const families = new DrizzleRefreshTokenFamilyRepository(database);
      const found = await families.findAndPrepare("refresh-t-1");

      await families.deleteFamilyTokens(found?.familyId ?? "");

      expect(await tokensOf(ANN)).toEqual(["t-2"]);
      const [kept] = await database
        .select({ id: session.id })
        .from(session)
        .where(eq(session.id, "a-rec"));
      expect(kept?.id).toBe("a-rec");
    });
  });

  describe("binding a token to its sign-in", () => {
    it("records the sid on the row that holds the refresh token, in any stored form", async () => {
      await token("t-raw", ANN, CLIENTS[0] as string, null);
      await token("t-hashed", ANN, CLIENTS[0] as string, null);
      await database
        .update(oauthAccessToken)
        .set({ refreshToken: `h1:${hashRefreshToken("refresh-t-hashed")}` })
        .where(eq(oauthAccessToken.id, "t-hashed"));
      const store = new DrizzleOAuthTokenSignInStore(database);

      await expect(store.bindRefreshToken("refresh-t-raw", "rec-1")).resolves.toBe(true);
      await expect(store.bindRefreshToken("refresh-t-hashed", "rec-2")).resolves.toBe(true);
      await expect(store.bindRefreshToken("refresh-unknown", "rec-3")).resolves.toBe(false);

      const rows = await database
        .select({ id: oauthAccessToken.id, sid: oauthAccessToken.sid })
        .from(oauthAccessToken)
        .where(inArray(oauthAccessToken.id, ["t-raw", "t-hashed"]));
      expect(Object.fromEntries(rows.map((row) => [row.id, row.sid]))).toEqual({
        "t-raw": "rec-1",
        "t-hashed": "rec-2",
      });
    });
  });

  describe("session expiry sweep", () => {
    function sweep(effects: { run: () => Promise<void> } = { run: async () => undefined }) {
      const logout = new BackchannelLogoutRevocationCoordinator(
        new DrizzleRpLogoutRepository(database),
      );
      const reserve = vi.fn(
        async ({ sessionIds }: { userId: string; sessionIds: readonly string[] }) => ({
          run: async () => {
            await logout.revokeIdentitySessions(sessionIds);
            await effects.run();
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

    const past = new Date(now.getTime() - 1_000);

    it("ends expired records with back-channel logout and their tokens, and touches nothing live", async () => {
      await record("old-rec", ANN, past);
      await record("live-rec", ANN);
      await database
        .insert(sessionLineage)
        .values({ previousSid: "old-before", sessionId: "old-rec", userId: ANN, createdAt: now });
      await rpSession(CLIENTS[0] as string, ANN, "old-before", "old-rec");
      await rpSession(CLIENTS[1] as string, ANN, "live-rec", "live-rec");
      await token("t-old", ANN, CLIENTS[0] as string, "old-before");
      await token("t-live", ANN, CLIENTS[1] as string, "live-rec");

      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(1);

      expect(await tokensOf(ANN)).toEqual(["t-live"]);
      const remaining = await database
        .select({ id: session.id })
        .from(session)
        .where(eq(session.userId, ANN));
      expect(remaining.map((row) => row.id)).toEqual(["live-rec"]);
      const deliveries = await database
        .select({ sid: oidcBackchannelLogoutDelivery.sid })
        .from(oidcBackchannelLogoutDelivery)
        .where(inArray(oidcBackchannelLogoutDelivery.clientId, CLIENTS));
      expect(deliveries.map((row) => row.sid)).toEqual(["old-before"]);
    });

    it("is idempotent", async () => {
      await record("old-rec", ANN, past);
      await rpSession(CLIENTS[0] as string, ANN, "old-rec", "old-rec");
      const { sweep: sweeper, reserve } = sweep();

      await expect(sweeper.run()).resolves.toBe(1);
      await expect(sweeper.run()).resolves.toBe(0);

      expect(reserve).toHaveBeenCalledOnce();
      const deliveries = await database
        .select({ id: oidcBackchannelLogoutDelivery.id })
        .from(oidcBackchannelLogoutDelivery)
        .where(inArray(oidcBackchannelLogoutDelivery.clientId, CLIENTS));
      expect(deliveries).toHaveLength(1);
    });

    it("re-runs safely when the sign-out was queued but the process stopped before the records went", async () => {
      await record("old-rec", ANN, past);
      await rpSession(CLIENTS[0] as string, ANN, "old-rec", "old-rec");
      const logout = new BackchannelLogoutRevocationCoordinator(
        new DrizzleRpLogoutRepository(database),
      );
      await logout.revokeIdentitySessions(["old-rec"]);

      const { sweep: sweeper } = sweep();
      await expect(sweeper.run()).resolves.toBe(1);

      const deliveries = await database
        .select({ id: oidcBackchannelLogoutDelivery.id })
        .from(oidcBackchannelLogoutDelivery)
        .where(inArray(oidcBackchannelLogoutDelivery.clientId, CLIENTS));
      expect(deliveries).toHaveLength(1);
    });

    it("skips records another instance is already working on, so none is handled twice", async () => {
      await record("rec-1", ANN, past);
      await record("rec-2", ANN, new Date(past.getTime() + 1));
      const store = new DrizzleSessionExpiryStore(database);
      const seenByOther: string[][] = [];
      const seenByFirst: string[][] = [];

      const first = store.endExpired(now, 1, async (batch) => {
        seenByFirst.push(batch.map((entry) => entry.id));
        // While the first instance holds rec-1, a second instance takes the next one instead.
        await store.endExpired(now, 10, async (other) => {
          seenByOther.push(other.map((entry) => entry.id));
        });
      });
      await first;

      // The sweep takes records in no particular order; what matters is that none is taken twice.
      expect(seenByFirst).toHaveLength(1);
      expect([...seenByFirst.flat(), ...seenByOther.flat()].sort()).toEqual(["rec-1", "rec-2"]);
      const left = await database
        .select({ id: session.id })
        .from(session)
        .where(eq(session.userId, ANN));
      expect(left).toEqual([]);
    });

    it("deletes nothing when the durable write fails, and a later run takes the records", async () => {
      await record("rec", ANN, past);
      const store = new DrizzleSessionExpiryStore(database);

      await expect(
        store.endExpired(now, 10, async () => {
          throw new Error("outbox down");
        }),
      ).rejects.toThrow("outbox down");

      const [still] = await database
        .select({ id: session.id })
        .from(session)
        .where(eq(session.id, "rec"));
      expect(still?.id).toBe("rec");
      await expect(store.endExpired(now, 10, async () => "ok")).resolves.toEqual({
        ended: 1,
        prepared: "ok",
      });
    });

    it("leaves a record that is live again alone", async () => {
      await record("rec", ANN, past);
      await database
        .update(session)
        .set({ expiresAt: new Date(now.getTime() + DAY) })
        .where(eq(session.id, "rec"));

      const store = new DrizzleSessionExpiryStore(database);
      await expect(store.endExpired(now, 10, async () => "x")).resolves.toBeNull();
      const [still] = await database
        .select({ id: session.id })
        .from(session)
        .where(eq(session.id, "rec"));
      expect(still?.id).toBe("rec");
    });
  });
});
