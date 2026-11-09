import { type AuthDatabase, createAuth } from "@auction/auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { parseAuthEnv } from "../env.js";
import { type CreateAuthAppOptions, createAuthApp } from "./create-auth-app.js";

/**
 * Better Auth can link and unlink a provider account on its own, with none of the hand-off's
 * checks (a ticket, a recent sign-in, the one email). Those two endpoints must be unreachable
 * from outside, whatever way the path is written. These tests send the requests through the real
 * issuer app and the real Better Auth handler, as a signed-in person would from a browser whose
 * origin is trusted, so a path that slips past the switch-off shows up as a changed account.
 */

const BASE = "https://auth.test";
const PASSWORD = "a-password-123";

type Rows = Record<string, Record<string, unknown>[]>;

async function realIssuer() {
  const rows: Rows = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
    jwks: [],
    oauthApplication: [],
    oauthAccessToken: [],
    oauthConsent: [],
  };
  const ports = {
    consentStore: { upsert: vi.fn(async (input) => input) },
    jwksStore: {
      getJwks: vi.fn(async () => []),
      getActiveSigningJwk: vi.fn(async () => null),
      createJwk: vi.fn(async (data) => ({ id: "kid-1", ...data })),
      getPublicJwks: vi.fn(async () => ({ keys: [] })),
      markKeyRetired: vi.fn(async () => undefined),
    },
    sessionStampStore: {
      stampPasswordAuth: vi.fn(async () => undefined),
      stampMfaCompleted: vi.fn(async () => undefined),
      stampSocialAuth: vi.fn(async () => undefined),
    },
    subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
    accountLinkReader: {
      countAccountsForUser: async (userId: string) =>
        rows.account?.filter((row) => row.userId === userId).length ?? 0,
      isEmailVerified: async () => true,
      findUserEmailProfile: async () => null,
    },
    phoneNumberStore: {
      purgeExpiredVerifications: vi.fn(async () => undefined),
      findPhoneNumber: vi.fn(async () => null),
      resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
    },
    twoFactorPolicyStore: {
      readSubjectPolicyInputs: async () => ({ markers: [], policies: [] }),
      readTwoFactorEnabled: async (ids: string[]) => new Map(ids.map((id) => [id, false])),
      readPolicy: async () => null,
      writePolicy: async () => undefined,
      countCoverage: async () => ({ members: 0, enrolled: 0 }),
      readLastSignIn: async () => new Map(),
    },
    email: undefined,
    sms: undefined,
    securityNotices: { notify: async () => undefined },
    events: { publish: async () => undefined },
  };
  const auth = createAuth({
    database: memoryAdapter(rows) as unknown as AuthDatabase,
    ports: ports as never,
    secret: "test-secret-that-is-long-enough-for-better-auth",
    baseURL: BASE,
    issuerURL: BASE,
    trustedOrigins: [BASE],
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
  });
  const context = await (
    auth as unknown as {
      $context: Promise<{
        internalAdapter: {
          createUser(data: unknown): Promise<{ id: string }>;
          createAccount(data: unknown): Promise<unknown>;
        };
        password: { hash(value: string): Promise<string> };
      }>;
    }
  ).$context;
  const user = await context.internalAdapter.createUser({
    id: "u1",
    email: "ada@example.com",
    name: "Ada",
    emailVerified: true,
  } as never);
  await context.internalAdapter.createAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(PASSWORD),
  } as never);
  await context.internalAdapter.createAccount({
    userId: user.id,
    providerId: "google",
    accountId: "google-sub-1",
  } as never);

  const counter = { inc: vi.fn() };
  const env = parseAuthEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost/auction",
    BETTER_AUTH_SECRET: "development-secret",
    OIDC_ISSUER_URL: BASE,
    WEB_ORIGIN: "https://web.test",
  });
  const app: Hono = createAuthApp({
    log: pino({ enabled: false }),
    issuerHttpOutcomes: counter,
    operational: {
      db: { execute: vi.fn(async () => ({ rows: [] })) },
      auth,
      nodeEnv: "test",
      metrics: { metrics: vi.fn(async () => "# metrics") },
      internal: { redis: {}, routes: new Hono() },
    },
    oidc: {
      env,
      db: {},
      sessionStampStore: {},
      readTwoFactorRequirement: vi.fn(async () => ({ required: false, sources: [] })),
      redis: {},
      auth,
      webOrigins: ["https://web.test"],
      refreshFamilies: {
        findAndPrepare: vi.fn(async () => null),
        completeRotation: vi.fn(async () => undefined),
        revokeFamily: vi.fn(async () => undefined),
      },
      idTokenRenewal: {
        rememberIssued: vi.fn(async () => undefined),
        renew: vi.fn(async () => null),
      },
      replay: {
        reserve: vi.fn(async () => true),
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
      },
      services: {
        oidc: {
          sessions: {},
          logout: {
            revokeIdentitySessions: vi.fn(),
            revokeSubject: vi.fn(),
            revokeClientSubject: vi.fn(),
          },
          logoutDelivery: {},
          confidentialClients: { authenticate: vi.fn(async () => null) },
          tokenManagement: {},
          tokenExchange: {},
        },
        ssf: { streams: {}, delivery: {} },
      },
      authHandler: (request: Request) => auth.handler(request),
      metrics: { refreshRotationOutcomes: counter, tokenExchangeOutcomes: counter },
    },
  } as unknown as CreateAuthAppOptions);

  // A signed-in browser: the cookie Better Auth set when the person signed in with their password.
  const signedIn = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email: "ada@example.com", password: PASSWORD }),
    }),
  );
  const cookie = (signedIn.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie.includes("session_token")) throw new Error("the test person did not sign in");
  return { app, rows, cookie };
}

const DISABLED = ["link-social", "unlink-account"] as const;

/** The ways someone might write the same path to get past an exact-match switch-off. */
const SPELLINGS: ReadonlyArray<[string, (name: string) => string]> = [
  ["exactly", (name) => `/api/auth/${name}`],
  ["with a trailing slash", (name) => `/api/auth/${name}/`],
  ["with a doubled slash", (name) => `/api/auth//${name}`],
  ["with a query", (name) => `/api/auth/${name}?x`],
  ["in capitals", (name) => `/api/auth/${name.toUpperCase()}`],
  ["with an encoded hyphen", (name) => `/api/auth/${name.replace("-", "%2D")}`],
  ["with an encoded slash after the base", (name) => `/api/auth%2F${name}`],
  ["with a dot segment", (name) => `/api/auth/./${name}`],
  ["through a parent segment", (name) => `/api/auth/x/../${name}`],
];

describe("Better Auth's own link and unlink endpoints, through the real issuer", () => {
  for (const name of DISABLED) {
    describe(`/api/auth/${name}`, () => {
      it.each(SPELLINGS)("is refused %s", async (_label, spell) => {
        const { app, rows, cookie } = await realIssuer();
        const accountsBefore = rows.account?.map((row) => `${row.userId}:${row.providerId}`).sort();
        const response = await app.request(`${BASE}${spell(name)}`, {
          method: "POST",
          headers: {
            cookie,
            origin: BASE,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            name === "link-social"
              ? { provider: "google", callbackURL: `${BASE}/x`, disableRedirect: true }
              : { providerId: "google" },
          ),
        });
        const text = await response.text();
        // Refused is not found, not allowed, or a bad request: never a success, never a provider URL.
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.headers.get("location")).toBeNull();
        expect(text).not.toContain("accounts.google.com");
        expect(text).not.toContain('"status":true');
        // Whatever was refused, nothing about the accounts changed.
        expect(rows.account?.map((row) => `${row.userId}:${row.providerId}`).sort()).toEqual(
          accountsBefore,
        );
      });

      it("is refused with other verbs and without a session or a trusted origin", async () => {
        const { app, cookie } = await realIssuer();
        const send = (init: RequestInit) => app.request(`${BASE}/api/auth/${name}`, init);
        for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
          expect(
            (await send({ method, headers: { cookie, origin: BASE } })).status,
          ).toBeGreaterThanOrEqual(400);
        }
        expect(
          (
            await send({
              method: "POST",
              headers: { origin: BASE, "content-type": "application/json" },
              body: "{}",
            })
          ).status,
        ).toBeGreaterThanOrEqual(400);
        expect(
          (
            await send({
              method: "POST",
              headers: { cookie, origin: "https://evil.test", "content-type": "application/json" },
              body: "{}",
            })
          ).status,
        ).toBeGreaterThanOrEqual(400);
      });
    });
  }
});
