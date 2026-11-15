import { createHash, randomBytes } from "node:crypto";
import { type AuthDatabase, createAuth } from "@auction/auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createOidcLoginPromptReader } from "../services/oidc-login-prompt.js";
import { IDENTIFY_ONLY } from "../services/session-read-query.js";
import { mountHostedAuthPages } from "./mount-hosted-auth-pages.js";

/**
 * LAX Account asks for a fresh sign-in with `prompt=login`. When the browser already holds an
 * issuer session, Better Auth's OIDC provider sends it to the sign-in page with only `client_id`,
 * `code` and `state`, keeping the rest of the request in its signed `oidc_login_prompt` cookie.
 * This goes through that real redirect, so the page must learn about the re-check from the
 * provider's own record, not from a URL a test wrote by hand. Run against the real Better Auth.
 */
const BASE = "https://auth.test";
const SECRET = "test-secret-that-is-long-enough-for-better-auth";
const ACCOUNT_CALLBACK = "http://localhost:3040/api/auth/callback";

const capabilities = {
  googleEnabled: false,
  appleEnabled: false,
  phoneEnabled: false,
  turnstileSiteKey: null,
  shopOrigin: "https://test-shop.lax.bid",
  artOrigin: "https://test-art.lax.bid",
  shopAdminOrigin: "https://test-shop-admin.lax.bid",
  bidOrigin: "https://test.lax.bid",
  accountOrigin: "http://localhost:3040",
  emailFirst: true,
  requireEmailVerification: true,
};

function issuerPorts() {
  return {
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
}

type IssuerContext = {
  secret: string;
  adapter: { create(input: { model: string; data: Record<string, unknown> }): Promise<unknown> };
  internalAdapter: {
    createUser(data: unknown): Promise<{ id: string }>;
    createAccount(data: unknown): Promise<unknown>;
  };
  password: { hash(value: string): Promise<string> };
};

class CookieJar {
  private readonly cookies = new Map<string, string>();

  keep(response: Response): void {
    for (const value of response.headers.getSetCookie?.() ?? []) {
      const [pair = ""] = value.split(";", 1);
      const separator = pair.indexOf("=");
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

/** The issuer as it runs: Better Auth under `/api/auth`, the hosted pages beside it. */
async function signedInIssuer(options: { readLoginPrompt: boolean }) {
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
  const auth = createAuth({
    database: memoryAdapter(rows) as unknown as AuthDatabase,
    ports: issuerPorts() as never,
    secret: SECRET,
    baseURL: BASE,
    issuerURL: BASE,
    trustedOrigins: [BASE],
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
  });
  const context = (await (auth as unknown as { $context: Promise<IssuerContext> })
    .$context) as IssuerContext;
  const now = new Date();
  await context.adapter.create({
    model: "oauthApplication",
    data: {
      clientId: "lax-account-web",
      name: "LAX Account",
      clientSecret: "hashed-account-secret",
      redirectUrls: ACCOUNT_CALLBACK,
      type: "web",
      disabled: false,
      createdAt: now,
      updatedAt: now,
    },
  });
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

  const app = new Hono();
  mountHostedAuthPages(app, {
    ...capabilities,
    getSession: (headers) => auth.api.getSession({ headers, query: IDENTIFY_ONLY }),
    readConfirmMethods: async () => ({
      password: true,
      passkey: false,
      providers: [],
      staff: false,
    }),
    ...(options.readLoginPrompt
      ? {
          readLoginPrompt: createOidcLoginPromptReader(
            async () => ((await auth.$context) as unknown as IssuerContext).secret,
          ),
        }
      : {}),
  });
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const jar = new CookieJar();
  const signedIn = await app.request(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "sam@example.com", password: "a-password-123" }),
  });
  jar.keep(signedIn);
  if (!jar.header().includes("session_token")) throw new Error("the test person did not sign in");
  return { app, jar };
}

/** What LAX Account sends before signing out a device. */
function accountReauthorize(): string {
  const url = new URL("/api/auth/oauth2/authorize", BASE);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: "lax-account-web",
    redirect_uri: ACCOUNT_CALLBACK,
    scope: "openid profile email",
    state: "account-state",
    nonce: "account-nonce",
    code_challenge: createHash("sha256")
      .update(randomBytes(32).toString("base64url"))
      .digest("base64url"),
    code_challenge_method: "S256",
    prompt: "login",
    max_age: "300",
    reauth_reason: "sign_out_devices",
  }).toString();
  return url.toString();
}

async function followReauthorize(options: { readLoginPrompt: boolean }) {
  const { app, jar } = await signedInIssuer(options);
  const authorize = await app.request(accountReauthorize(), {
    headers: { cookie: jar.header() },
  });
  jar.keep(authorize);
  const location = authorize.headers.get("location") ?? "";
  const page = await app.request(new URL(location, BASE).toString(), {
    headers: { cookie: jar.header() },
  });
  return { authorize, location: new URL(location, BASE), page, html: await page.text() };
}

describe("Confirm it's you after the provider's real prompt=login redirect", () => {
  it("is where the provider sends a signed-in browser, without the request in the URL", async () => {
    const { authorize, location } = await followReauthorize({ readLoginPrompt: true });
    expect(authorize.status).toBe(302);
    expect(location.pathname).toBe("/login");
    expect([...location.searchParams.keys()].sort()).toEqual(["client_id", "code", "state"]);
    expect(authorize.headers.getSetCookie().join("\n")).toContain("oidc_login_prompt=");
  });

  it("confirms the signed-in person, with the reason and no sign-up", async () => {
    const { page, html } = await followReauthorize({ readLoginPrompt: true });
    expect(page.status).toBe(200);
    expect(html).toContain("confirm-root");
    expect(html).toContain("<h1>Confirm it&#39;s you</h1>");
    expect(html).toContain('data-email="sam@example.com"');
    expect(html).toContain("Before you sign out another device, we need you to sign in again.");
    expect(html).not.toContain("Sign up");
  });

  it("is the ordinary sign-in when the provider's record is not read", async () => {
    const { html } = await followReauthorize({ readLoginPrompt: false });
    expect(html).not.toContain("confirm-root");
    expect(html).not.toContain("Confirm it&#39;s you");
  });
});
