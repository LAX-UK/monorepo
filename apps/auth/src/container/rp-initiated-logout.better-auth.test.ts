import { type AuthDatabase, createAuth } from "@auction/auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createRpInitiatedLogoutRoutes } from "../routes/rp-initiated-logout.routes.js";
import { BrowserSignOutService } from "../services/browser-sign-out.service.js";

/**
 * The route ends a browser's sign-in through Better Auth's own sign-out. These tests run that
 * against the real Better Auth handler: the call the route builds must pass its origin check, end
 * the session behind the cookie, expire the cookie, and never reach its end-session (which deletes
 * every OAuth token of the person).
 */
const BASE = "https://auth.test";

async function realIssuer() {
  const rows: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
    jwks: [],
    oauthApplication: [],
    oauthAccessToken: [
      { id: "tok-ann-other-device", userId: "ann", clientId: "c", accessToken: "x" },
    ],
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
  const person = await context.internalAdapter.createUser({
    id: "ann",
    email: "ann@example.com",
    name: "Ann",
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
      body: JSON.stringify({ email: "ann@example.com", password: "a-password-123" }),
    }),
  );
  const cookie = (signedIn.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie.includes("session_token")) throw new Error("the test person did not sign in");
  return { auth, rows, cookie };
}

describe("signing out of one browser, through the real Better Auth", () => {
  it("ends the session behind the cookie, expires the cookie, and leaves every token alone", async () => {
    const { auth, rows, cookie } = await realIssuer();
    const sessionId = String(rows.session?.[0]?.id);
    const authHandler = vi.fn((request: Request) => auth.handler(request));
    const routes = createRpInitiatedLogoutRoutes({
      authHandler,
      verifier: { verify: vi.fn(async () => null) },
      currentSession: async (headers) => {
        const found = await auth.api.getSession({ headers });
        const subjectId = found?.user?.id;
        const sessionId = found?.session?.id;
        return subjectId && sessionId ? { subjectId, sessionId } : null;
      },
      revokeIdentitySession: vi.fn(),
      signOut: new BrowserSignOutService(
        { earlierNames: async () => [], deleteTokensIssuedUnder: async () => 0 },
        { revokeIdentitySessions: vi.fn(async () => 1) },
        async () => undefined,
      ),
    });

    // Mounted where the issuer mounts it, so the sign-out path is the one Better Auth serves.
    const app = new Hono().route("/api/auth", routes);
    // The browser's own request to the issuer, as LAX Account sends it with no ID token.
    const response = await app.request(
      new Request(
        `${BASE}/api/auth/oauth2/endsession?client_id=lax-account-web&post_logout_redirect_uri=${encodeURIComponent(
          "https://account.lax.bid/",
        )}`,
        { headers: { cookie, "sec-fetch-site": "same-site" } },
      ),
    );

    expect(authHandler).toHaveBeenCalledOnce();
    expect(rows.session?.some((row) => row.id === sessionId)).toBe(false);
    expect(response.headers.getSetCookie().join(";")).toMatch(/session_token=;/);
    expect(rows.oauthAccessToken?.map((row) => row.id)).toEqual(["tok-ann-other-device"]);
    expect(response.status).toBe(302);
  });
});
