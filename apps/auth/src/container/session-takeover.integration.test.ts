import { randomUUID } from "node:crypto";
import { createIdentityDb } from "@auction/identity-db";
import {
  oauthApplication,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
  session,
  sessionLineage,
  user,
} from "@auction/identity-db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrizzleRpLogoutRepository } from "../infrastructure/drizzle-backchannel-logout.adapters.js";
import { DrizzleOidcRpSessionRepository } from "../infrastructure/oidc-session-adapters.js";
import { BackchannelLogoutRevocationCoordinator } from "../services/backchannel-logout-revocation.service.js";
import { DEVICE_MARKER_COOKIE, DeviceMarkerHasher } from "../services/device-marker.js";
import { DurableSecurityEffects } from "../services/durable-security-effects.js";
import { InMemorySecurityEffectOutbox } from "../services/durable-security-effects.test-util.js";
import {
  type IdTokenContinuityRecord,
  type IdTokenContinuityStore,
  RefreshedIdTokenService,
} from "../services/refreshed-id-token.service.js";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";
import { createDeviceSessions } from "./create-device-sessions.js";

const DATABASE_URL = process.env.DATABASE_URL;
const run = randomUUID().slice(0, 8);
const ANN = `sd1-${run}-ann`;
const BEN = `sd1-${run}-ben`;
const CLIENT = `sd1-${run}-bid`;
const MARKER_SECRET = "m".repeat(32);

const CREATORS = {
  "step-up (Confirm it's you)": "/api/auth/sign-in/email",
  "email link": "/api/auth/magic-link/verify",
  "email confirmation link": "/api/auth/verify-email",
  Google: "/api/auth/callback/google",
  Apple: "/api/auth/callback/apple",
  "two-step": "/api/auth/two-factor/verify-totp",
  passkey: "/api/auth/passkey/verify-authentication",
} as const;

describe.skipIf(!DATABASE_URL)("one sign-in record per browser", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  let counter = 0;

  /** Stands in for Better Auth: creates a session row and sets its cookie, as every sign-in does. */
  const betterAuth = {
    handler: async (request: Request) => {
      const userId = request.headers.get("x-test-user") ?? "";
      const id = `sd1-${run}-s${counter++}`;
      const now = new Date();
      await db?.insert(session).values({
        id,
        token: `tok-${id}`,
        userId,
        expiresAt: new Date(now.getTime() + 7 * 86_400_000),
        createdAt: now,
        updatedAt: now,
      });
      return Response.json(
        { ok: true },
        { headers: { "set-cookie": `better-auth.session_token=tok-${id}.sig; Path=/; HttpOnly` } },
      );
    },
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const token = /better-auth\.session_token=([^.;]+)/.exec(headers.get("cookie") ?? "")?.[1];
        if (!token || !db) return null;
        const [row] = await db.select().from(session).where(eq(session.token, token)).limit(1);
        return row && row.expiresAt > new Date()
          ? { session: { id: row.id }, user: { id: row.userId } }
          : null;
      },
      revokeOtherSessions: vi.fn(),
    },
  };

  const logoutCoordinator = db
    ? new BackchannelLogoutRevocationCoordinator(new DrizzleRpLogoutRepository(db))
    : undefined;
  const log = { warn: vi.fn(), error: vi.fn() };
  const durable = new DurableSecurityEffects(
    new InMemorySecurityEffectOutbox(),
    {
      operations: { removeOtherSessions: vi.fn() },
      logout: logoutCoordinator,
      events: { publish: vi.fn(async () => undefined) },
      notices: { deliver: vi.fn() },
      email: { enqueue: vi.fn() },
    } as never,
    log,
  );
  const handler = db
    ? createAuthRequestHandler({
        log,
        durable,
        notices: { notify: vi.fn(async () => undefined) },
        sessionStampStore: {} as never,
        readTwoFactorRequirement: (async () => ({ required: false, sources: [] })) as never,
        auth: betterAuth as never,
        deviceSessions: createDeviceSessions({
          db,
          auth: betterAuth as never,
          durable,
          secrets: { deviceMarker: MARKER_SECRET, issuer: "issuer-secret-0123456789" },
          log,
        }),
        oidcSessions: {
          runTokenRequest: async (_code: string | null, action: () => Promise<Response>) =>
            action(),
          captureAuthorizationSession: vi.fn(),
        } as never,
      })
    : undefined;
  const hasher = new DeviceMarkerHasher({
    secret: MARKER_SECRET,
    fallbackSecret: "issuer-secret-0123456789",
  });

  /** A browser's cookie jar: what a real one would send back on its next request. */
  class Browser {
    readonly jar = new Map<string, string>();

    cookieHeader(): string {
      return [...this.jar].map(([name, value]) => `${name}=${value}`).join("; ");
    }

    get marker(): string | undefined {
      return this.jar.get(DEVICE_MARKER_COOKIE);
    }

    async signIn(path: string, userId: string): Promise<Response> {
      const response = await (handler as NonNullable<typeof handler>)(
        new Request(`https://auth.test${path}`, {
          method: "POST",
          headers: { cookie: this.cookieHeader(), "x-test-user": userId },
        }),
      );
      for (const setCookie of response.headers.getSetCookie()) {
        const [pair] = setCookie.split(";");
        const separator = pair?.indexOf("=") ?? -1;
        if (!pair || separator < 0) continue;
        this.jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return response;
    }

    forgetSessionCookie(): void {
      this.jar.delete("better-auth.session_token");
    }
  }

  const liveRecordsOf = async (...userIds: string[]) =>
    (db as NonNullable<typeof db>).select().from(session).where(inArray(session.userId, userIds));

  async function clearState(): Promise<void> {
    if (!db) return;
    await db
      .delete(oidcBackchannelLogoutDelivery)
      .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT));
    await db.delete(oidcRpSession).where(eq(oidcRpSession.clientId, CLIENT));
    await db.delete(user).where(inArray(user.id, [ANN, BEN]));
    await db.delete(oauthApplication).where(eq(oauthApplication.clientId, CLIENT));
  }

  beforeAll(async () => {
    if (!db) return;
    await clearState();
    const now = new Date();
    await db.insert(user).values(
      [ANN, BEN].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await db.insert(oauthApplication).values({
      id: `${CLIENT}-app`,
      name: "LAX Bid test client",
      clientId: CLIENT,
      redirectUrls: "https://bid.example.test/callback",
      type: "web",
      backchannelLogoutUri: "https://bid.example.test/backchannel-logout",
      createdAt: now,
      updatedAt: now,
    });
  });
  afterAll(clearState);

  async function reset(): Promise<void> {
    if (!db) return;
    await db.delete(session).where(inArray(session.userId, [ANN, BEN]));
    await db
      .delete(oidcBackchannelLogoutDelivery)
      .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT));
    await db.delete(oidcRpSession).where(eq(oidcRpSession.clientId, CLIENT));
  }

  it.each(Object.entries(CREATORS))(
    "a second sign-in by %s leaves exactly one record in the browser",
    async (_label, path) => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [first] = await liveRecordsOf(ANN);
      await browser.signIn(path, ANN);
      await browser.signIn(path, ANN);

      const records = await liveRecordsOf(ANN);
      expect(records).toHaveLength(1);
      // The browser's sign-in is carried over, not restarted.
      expect(records[0]?.signedInAt?.getTime()).toBe(first?.createdAt.getTime());
      const lineage = await (db as NonNullable<typeof db>)
        .select()
        .from(sessionLineage)
        .where(eq(sessionLineage.sessionId, records[0]?.id ?? ""));
      expect(lineage).toHaveLength(2);
    },
  );

  it("switching to another person in the same browser leaves one record, theirs", async () => {
    await reset();
    const browser = new Browser();
    await browser.signIn("/api/auth/sign-in/email", ANN);
    await browser.signIn("/api/auth/sign-in/email", BEN);
    const records = await liveRecordsOf(ANN, BEN);
    expect(records.map((record) => record.userId)).toEqual([BEN]);
  });

  it("leaves another browser's record alone", async () => {
    await reset();
    const laptop = new Browser();
    const phone = new Browser();
    await laptop.signIn("/api/auth/sign-in/email", ANN);
    await phone.signIn("/api/auth/sign-in/email", ANN);
    await laptop.signIn("/api/auth/sign-in/email", ANN);
    expect(await liveRecordsOf(ANN)).toHaveLength(2);
  });

  it("keeps only a keyed hash of the marker on the record", async () => {
    await reset();
    const browser = new Browser();
    await browser.signIn("/api/auth/sign-in/email", ANN);
    const [record] = await liveRecordsOf(ANN);
    expect(browser.marker).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(record?.deviceHash).toBe(hasher.hash(browser.marker ?? ""));
    expect(record?.deviceHash).not.toContain(browser.marker ?? "");
  });

  it("finds the browser by its marker when the session cookie is gone (two-step, expired cookie)", async () => {
    await reset();
    const browser = new Browser();
    await browser.signIn("/api/auth/sign-in/email", ANN);
    browser.forgetSessionCookie();
    await browser.signIn("/api/auth/two-factor/verify-totp", ANN);
    expect(await liveRecordsOf(ANN)).toHaveLength(1);
  });

  it("takes over a record made before the marker existed, by its cookie", async () => {
    await reset();
    const database = db as NonNullable<typeof db>;
    const legacyId = `sd1-${run}-legacy`;
    const created = new Date(Date.now() - 3 * 86_400_000);
    await database.insert(session).values({
      id: legacyId,
      token: "tok-legacy",
      userId: ANN,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: created,
      updatedAt: created,
    });
    const browser = new Browser();
    browser.jar.set("better-auth.session_token", "tok-legacy.sig");
    await browser.signIn("/api/auth/sign-in/email", ANN);

    const records = await liveRecordsOf(ANN);
    expect(records).toHaveLength(1);
    expect(records[0]?.id).not.toBe(legacyId);
    expect(records[0]?.signedInAt?.getTime()).toBe(created.getTime());
    const [name] = await database
      .select()
      .from(sessionLineage)
      .where(eq(sessionLineage.previousSid, legacyId));
    expect(name?.sessionId).toBe(records[0]?.id);
  });

  it("still lists, finds and ends records that carry no device hash", async () => {
    await reset();
    const database = db as NonNullable<typeof db>;
    const id = `sd1-${run}-plain`;
    await database.insert(session).values({
      id,
      token: "tok-plain",
      userId: ANN,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = new DrizzleOidcRpSessionRepository(database);
    await expect(repository.findLiveIdentitySession(id, new Date())).resolves.toMatchObject({ id });
  });

  describe("products that signed in through the old record", () => {
    const signer = {
      sign: vi.fn(async (input: { claims: Record<string, unknown> }) => ({
        token: JSON.stringify(input.claims),
        kid: "k",
      })),
    };
    const continuity = (): IdTokenContinuityStore => {
      const records = new Map<string, IdTokenContinuityRecord>();
      return {
        put: async (hash, record) => void records.set(hash, record),
        take: async (hash) => {
          const record = records.get(hash) ?? null;
          records.delete(hash);
          return record;
        },
      };
    };
    const renewer = () =>
      new RefreshedIdTokenService({
        continuity: continuity(),
        findLiveIdentitySession: (sid) =>
          new DrizzleOidcRpSessionRepository(db as NonNullable<typeof db>).findLiveIdentitySession(
            sid,
            new Date(),
          ),
        isSubjectActive: async () => true,
        accessClaims: async () => ({}),
        signer,
        idTokenTtlSec: 900,
        continuityTtlSec: 2_592_000,
      });

    async function signInToBid(browser: Browser, sid: string) {
      const database = db as NonNullable<typeof db>;
      const now = new Date();
      await database.insert(oidcRpSession).values({
        clientId: CLIENT,
        subjectId: ANN,
        sid,
        identitySessionId: sid,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
      });
      const service = renewer();
      await service.rememberIssued({
        refreshToken: "refresh-1",
        idToken: `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
          JSON.stringify({ iss: "https://auth.test", sid, sub: ANN, aud: CLIENT, nonce: "n" }),
        ).toString("base64url")}.`,
      });
      return { service, browser };
    }

    it("LAX Bid stays signed in after a step-up in the same browser", async () => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [original] = await liveRecordsOf(ANN);
      const { service } = await signInToBid(browser, original?.id ?? "");

      // "Confirm it's you" in LAX Account: a new record takes over, the old one is deleted.
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [current] = await liveRecordsOf(ANN);
      expect(current?.id).not.toBe(original?.id);

      const token = await service.renew({
        previousRefreshToken: "refresh-1",
        nextRefreshToken: "refresh-2",
      });
      expect(token).not.toBeNull();
      // Bid matches back-channel logout by the sid it signed in with, so that stays.
      expect(JSON.parse(token ?? "{}")).toMatchObject({ sid: original?.id });

      // Signing out the browser's record signs Bid out, by the sid Bid knows.
      await logoutCoordinator?.revokeIdentitySessions([current?.id ?? ""]);
      const deliveries = await (db as NonNullable<typeof db>)
        .select()
        .from(oidcBackchannelLogoutDelivery)
        .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT));
      expect(deliveries.map((delivery) => delivery.sid)).toEqual([original?.id]);
    });

    it("keeps working through several step-ups in a row", async () => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [original] = await liveRecordsOf(ANN);
      const { service } = await signInToBid(browser, original?.id ?? "");
      for (let n = 0; n < 3; n += 1) await browser.signIn("/api/auth/sign-in/email", ANN);

      expect(await liveRecordsOf(ANN)).toHaveLength(1);
      await expect(
        service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
      ).resolves.not.toBeNull();
    });

    it("never revives an ended sign-in: once the record is gone the old name finds nothing", async () => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [original] = await liveRecordsOf(ANN);
      const { service } = await signInToBid(browser, original?.id ?? "");
      await browser.signIn("/api/auth/sign-in/email", ANN);
      await (db as NonNullable<typeof db>).delete(session).where(eq(session.userId, ANN));

      await expect(
        service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
      ).resolves.toBeNull();
    });

    it("a different person in the same browser ends the first person's record, and signs their products out", async () => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      const [annRecord] = await liveRecordsOf(ANN);
      const { service } = await signInToBid(browser, annRecord?.id ?? "");

      await browser.signIn("/api/auth/sign-in/email", BEN);

      expect(await liveRecordsOf(ANN)).toHaveLength(0);
      const deliveries = await (db as NonNullable<typeof db>)
        .select()
        .from(oidcBackchannelLogoutDelivery)
        .where(eq(oidcBackchannelLogoutDelivery.clientId, CLIENT));
      expect(deliveries.map((delivery) => [delivery.subjectId, delivery.sid])).toEqual([
        [ANN, annRecord?.id],
      ]);
      const [rp] = await (db as NonNullable<typeof db>)
        .select()
        .from(oidcRpSession)
        .where(and(eq(oidcRpSession.clientId, CLIENT), eq(oidcRpSession.sid, annRecord?.id ?? "")));
      expect(rp?.revokedAt).not.toBeNull();
      // The first person's product can no longer renew.
      await expect(
        service.renew({ previousRefreshToken: "refresh-1", nextRefreshToken: "refresh-2" }),
      ).resolves.toBeNull();
    });

    it("ends the first person's record by the marker alone when the cookie is gone", async () => {
      await reset();
      const browser = new Browser();
      await browser.signIn("/api/auth/sign-in/email", ANN);
      browser.forgetSessionCookie();
      await browser.signIn("/api/auth/sign-in/email", BEN);
      expect((await liveRecordsOf(ANN, BEN)).map((record) => record.userId)).toEqual([BEN]);
    });
  });

  it("keeps at most 20 earlier names per record, dropping the oldest", async () => {
    await reset();
    const browser = new Browser();
    await browser.signIn("/api/auth/sign-in/email", ANN);
    const [first] = await liveRecordsOf(ANN);
    for (let n = 0; n < 24; n += 1) await browser.signIn("/api/auth/sign-in/email", ANN);

    const [record] = await liveRecordsOf(ANN);
    const names = await (db as NonNullable<typeof db>)
      .select()
      .from(sessionLineage)
      .where(eq(sessionLineage.sessionId, record?.id ?? ""));
    expect(names).toHaveLength(20);
    expect(names.map((name) => name.previousSid)).not.toContain(first?.id);
  });
});
