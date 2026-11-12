import { createHmac } from "node:crypto";
import { type AuthDatabase, createAuth } from "@auction/auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { createSessionReaders } from "./create-device-sessions.js";

/**
 * A person whose sign-in is held under a week (every staff record, whose idle limit is 12 hours)
 * is renewed by Better Auth on every read, because it renews whenever less than six days remain.
 * A renewal sets a session cookie on the response, and in a request that carries the hosted
 * page's `oidc_login_prompt` cookie the OIDC provider answers that by continuing an authorization
 * with no request ("request not found"). The readers the device hook uses to identify a sign-in
 * must therefore never renew. Run against the real Better Auth.
 */
const BASE = "https://auth.test";
const SECRET = "test-secret-that-is-long-enough-for-better-auth";
const SHORT_LIFE_MS = 12 * 3_600_000;

/** A value signed the way Better Auth signs its cookies: `value.base64(HMAC-SHA256)`, URL-encoded. */
function signedCookieValue(value: string): string {
  const signature = createHmac("sha256", SECRET).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

async function issuerWithShortLivedSignIn() {
  const rows: Record<string, Record<string, unknown>[]> = {
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
      stampPasskeyAuth: vi.fn(async () => undefined),
    },
    subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
    accountLinkReader: {
      countAccountsForUser: async () => 1,
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
    secret: SECRET,
    baseURL: BASE,
    issuerURL: BASE,
    trustedOrigins: [BASE],
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
    sessionExpiry: {
      // The shape of the staff clamp: never more than 12 hours ahead.
      clamp: async ({ expiresAt }) =>
        new Date(Math.min(expiresAt.getTime(), Date.now() + SHORT_LIFE_MS)),
    },
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
  const person = await context.internalAdapter.createUser({
    id: "sam",
    email: "sam@example.com",
    name: "Sam",
    emailVerified: true,
  } as never);
  await context.internalAdapter.createAccount({
    userId: person.id,
    providerId: "credential",
    accountId: person.id,
    password: await context.password.hash("a-password-123"),
  } as never);
  const signedIn = await auth.handler(
    new Request(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email: "sam@example.com", password: "a-password-123" }),
    }),
  );
  const sessionCookie = (signedIn.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";")[0])
    .filter((value) => value?.includes("session_token"))
    .join("; ");
  if (!sessionCookie) throw new Error("the test person did not sign in");
  // What the hosted sign-in page's request carries while an authorization waits for the sign-in.
  const prompt = `oidc_login_prompt=${signedCookieValue(
    JSON.stringify({ client_id: "lax-bid-web", response_type: "code", prompt: "login" }),
  )}`;
  return { auth, rows, headers: new Headers({ cookie: `${sessionCookie}; ${prompt}` }) };
}

describe("identifying a sign-in does not renew it", () => {
  it("reads a short-lived sign-in under the hosted page's login prompt without renewing or failing", async () => {
    const { auth, rows, headers } = await issuerWithShortLivedSignIn();
    const before = { ...rows.session?.[0] };
    const readers = createSessionReaders(auth.api);

    const live = await readers.readSession(headers);
    const cached = await readers.readCachedSession(headers);

    expect(live?.id).toBe(before.id);
    expect(cached?.id).toBe(before.id);
    expect(rows.session?.[0]?.expiresAt).toEqual(before.expiresAt);
    expect(rows.session?.[0]?.updatedAt).toEqual(before.updatedAt);
  });

  it("is what the plain read gets wrong: it renews the record and the login prompt then fails it", async () => {
    const { auth, headers } = await issuerWithShortLivedSignIn();

    await expect(
      auth.api.getSession({ headers, query: { disableCookieCache: true } }),
    ).rejects.toMatchObject({ body: { error_description: "request not found" } });
  });
});
