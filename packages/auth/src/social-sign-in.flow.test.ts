import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthDatabase } from "./phone-number-plugin.js";
import type {
  AccessMarker,
  AuthPorts,
  IdentityLifecycleEvent,
  SecurityNoticeEvent,
  TwoFactorPolicyStore,
} from "./ports/index.js";
import { createAuth } from "./server.js";

/**
 * The whole Google round trip against a real Better Auth instance on an in-memory database: the
 * sign-in request, the provider's answer (the token endpoint is faked), and the callback. These
 * tests exist to prove what the hooks do to real accounts, not what their parts return.
 */

const BASE = "https://auth.test";
const PRODUCT_LOGIN = `${BASE}/login?client_id=lax-shop-web`;
const GOOGLE_SUB = "google-sub-1";

type Rows = Record<string, Record<string, unknown>[]>;

function unsignedJwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.`;
}

type Harness = Awaited<ReturnType<typeof harness>>;

async function harness(options: {
  staff?: string[];
  revokeAllSessions?: (userId: string) => Promise<number>;
  /** Makes the staff and two-step read fail, as a database outage would. */
  failPolicyRead?: boolean;
}) {
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
  const notices: SecurityNoticeEvent[] = [];
  const events: IdentityLifecycleEvent[] = [];
  const policyReadFailures: unknown[] = [];
  const staff = new Set(options.staff ?? []);
  const user = (id: string) => rows.user?.find((row) => row.id === id);

  const policy: TwoFactorPolicyStore = {
    readSubjectPolicyInputs: async (subjectId) => {
      if (options.failPolicyRead) throw new Error("identity database unavailable");
      return {
        markers: staff.has(subjectId)
          ? ([{ kind: "staff", product: "bid" }] as AccessMarker[])
          : [],
        policies: [],
      };
    },
    readTwoFactorEnabled: async (ids) =>
      new Map(ids.map((id) => [id, user(id)?.twoFactorEnabled === true])),
    readPolicy: async () => null,
    writePolicy: async () => {
      throw new Error("not used");
    },
    countCoverage: async () => ({ members: 0, enrolled: 0 }),
    readLastSignIn: async () => new Map(),
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
      countAccountsForUser: async (userId: string) =>
        rows.account?.filter((row) => row.userId === userId).length ?? 0,
      isEmailVerified: async (userId: string) => {
        const row = user(userId);
        return row ? row.emailVerified === true : null;
      },
      findUserEmailProfile: async (userId: string) => {
        const row = user(userId);
        return row
          ? {
              email: String(row.email),
              name: String(row.name),
              createdAt: new Date(row.createdAt as Date),
            }
          : null;
      },
    },
    phoneNumberStore: {
      purgeExpiredVerifications: vi.fn(async () => undefined),
      findPhoneNumber: vi.fn(async () => null),
      resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
    },
    twoFactorPolicyStore: policy,
    email: undefined,
    sms: undefined,
    securityNotices: { notify: async (event: SecurityNoticeEvent) => void notices.push(event) },
    events: { publish: async (event: IdentityLifecycleEvent) => void events.push(event) },
  } as unknown as AuthPorts;

  const revoked: string[] = [];
  const revokeAllSessions =
    options.revokeAllSessions ??
    (async (userId: string) => {
      revoked.push(userId);
      const before = rows.session?.length ?? 0;
      rows.session = (rows.session ?? []).filter((row) => row.userId !== userId);
      return before - rows.session.length;
    });

  const auth = createAuth({
    database: memoryAdapter(rows) as unknown as AuthDatabase,
    ports,
    secret: "test-secret-that-is-long-enough-for-better-auth",
    baseURL: BASE,
    issuerURL: BASE,
    trustedOrigins: [BASE],
    googleClientId: "google-client",
    googleClientSecret: "google-secret",
    revokeAllSessions,
    onSocialPolicyReadFailed: (error) => void policyReadFailures.push(error),
  });
  const context = await auth.$context;

  /** An account that already exists on LAX, with a password, made the ordinary way. */
  async function createAccount(input: {
    id: string;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled?: boolean;
    withPassword?: boolean;
  }) {
    const created = await context.internalAdapter.createUser({
      id: input.id,
      email: input.email,
      name: "Existing Person",
      emailVerified: input.emailVerified,
      twoFactorEnabled: input.twoFactorEnabled ?? false,
    } as never);
    if (input.withPassword !== false) {
      await context.internalAdapter.createAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: await context.password.hash("a-password-123"),
      } as never);
    }
    return created;
  }

  async function sessionFor(userId: string) {
    return context.internalAdapter.createSession(userId);
  }

  /** Presses "Continue with Google", then comes back from Google as `email`. */
  async function continueWithGoogle(email: string, extra: { emailVerified?: boolean } = {}) {
    const start = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({
          provider: "google",
          callbackURL: PRODUCT_LOGIN,
          errorCallbackURL: PRODUCT_LOGIN,
        }),
      }),
    );
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    const cookie = (start.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; ");
    const idToken = unsignedJwt({
      iss: "https://accounts.google.com",
      aud: "google-client",
      sub: GOOGLE_SUB,
      email,
      email_verified: extra.emailVerified ?? true,
      name: "Google Person",
    });
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const target = String(
          typeof input === "string" || input instanceof URL ? input : input.url,
        );
        if (target.startsWith("https://oauth2.googleapis.com/token")) {
          return Response.json({
            access_token: "access",
            id_token: idToken,
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        return realFetch(input, init);
      }),
    );
    try {
      return await auth.handler(
        new Request(
          `${BASE}/api/auth/callback/google?code=abc&state=${encodeURIComponent(state)}`,
          {
            method: "GET",
            headers: { cookie },
          },
        ),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  }

  /**
   * The hand-off the issuer runs for a person on Security: the link request with their own
   * session (the code path `/account-action` calls), then the provider's answer as `claims`.
   */
  async function linkFromSecurity(
    email: string,
    claims: Record<string, unknown>,
    options: {
      sub?: string;
      password?: string;
      formPost?: boolean;
      /** A link started some other way than the issuer's hand-off. */
      withoutMarker?: boolean;
      /** What the mark says; the hand-off sends `true`. */
      marker?: unknown;
    } = {},
  ) {
    const signedIn = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ email, password: options.password ?? "a-password-123" }),
      }),
    );
    const cookieOf = (response: Response) =>
      (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]).join("; ");
    const sessionCookie = cookieOf(signedIn);
    const start = await auth.api.linkSocialAccount({
      headers: new Headers({ cookie: sessionCookie, origin: BASE }),
      body: {
        provider: "google",
        callbackURL: `${BASE}/account-action/done?provider=google`,
        errorCallbackURL: `${BASE}/account-action/done?provider=google`,
        disableRedirect: true,
        ...(options.withoutMarker
          ? {}
          : { additionalData: { accountAction: options.marker ?? true } }),
      },
      asResponse: true,
    });
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    const cookie = [sessionCookie, cookieOf(start)].filter(Boolean).join("; ");
    const idToken = unsignedJwt({
      iss: "https://accounts.google.com",
      aud: "google-client",
      sub: options.sub ?? GOOGLE_SUB,
      email_verified: true,
      name: "Google Person",
      ...claims,
    });
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const target = String(
          typeof input === "string" || input instanceof URL ? input : input.url,
        );
        if (target.startsWith("https://oauth2.googleapis.com/token")) {
          return Response.json({
            access_token: "access",
            id_token: idToken,
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        return realFetch(input, init);
      }),
    );
    const callback = `${BASE}/api/auth/callback/google?code=abc&state=${encodeURIComponent(state)}`;
    try {
      if (options.formPost) {
        // Apple answers with a cross-site form POST. The library turns it into a GET on the same
        // address, which the browser follows with the cookies it already holds.
        const posted = await auth.handler(
          new Request(`${BASE}/api/auth/callback/google`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE },
            body: new URLSearchParams({ code: "abc", state }).toString(),
          }),
        );
        formPostRedirect = posted;
        const next = posted.headers.get("location");
        if (!next) return posted;
        return await auth.handler(
          new Request(new URL(next, BASE), { method: "GET", headers: { cookie } }),
        );
      }
      return await auth.handler(new Request(callback, { method: "GET", headers: { cookie } }));
    } finally {
      vi.unstubAllGlobals();
    }
  }
  let formPostRedirect: Response | null = null;

  return {
    auth,
    context,
    rows,
    notices,
    events,
    policyReadFailures,
    revoked,
    createAccount,
    sessionFor,
    continueWithGoogle,
    linkFromSecurity,
    formPostRedirect: () => formPostRedirect,
    ports,
  };
}

function location(response: Response): URL {
  const target = response.headers.get("location");
  if (!target) throw new Error(`no redirect (status ${response.status})`);
  return new URL(target, BASE);
}

function providerAccounts(h: Harness) {
  return h.rows.account?.filter((row) => row.providerId === "google") ?? [];
}

function passwordAccounts(h: Harness) {
  return h.rows.account?.filter((row) => row.providerId === "credential") ?? [];
}

let h: Harness;

describe("Google sign-in against an existing LAX account", () => {
  describe("an ordinary account with a confirmed email and no two-step (SM4: still smooth)", () => {
    beforeEach(async () => {
      h = await harness({});
    });

    it("is joined to Google and signed in, as before", async () => {
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      const response = await h.continueWithGoogle("ada@example.com");
      expect(location(response).toString().startsWith(PRODUCT_LOGIN)).toBe(true);
      expect(location(response).searchParams.get("error")).toBeNull();
      expect(providerAccounts(h)).toHaveLength(1);
      expect(passwordAccounts(h)).toHaveLength(1);
      expect(h.rows.session?.some((row) => row.userId === "u1")).toBe(true);
    });

    it("signs in again through the link it already has", async () => {
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      await h.continueWithGoogle("ada@example.com");
      const sessionsBefore = h.rows.session?.length ?? 0;
      const again = await h.continueWithGoogle("ada@example.com");
      expect(location(again).searchParams.get("error")).toBeNull();
      expect(providerAccounts(h)).toHaveLength(1);
      expect(h.rows.session?.length).toBe(sessionsBefore + 1);
    });
  });

  describe("SM4: an account that chose stronger protection is never joined silently", () => {
    it("refuses to join Google to an account with two-step verification, and signs no one in", async () => {
      h = await harness({});
      await h.createAccount({
        id: "u1",
        email: "ada@example.com",
        emailVerified: true,
        twoFactorEnabled: true,
      });
      const response = await h.continueWithGoogle("ada@example.com");
      const target = location(response);
      expect(`${target.origin}${target.pathname}`).toBe(`${BASE}/login`);
      expect(target.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(target.searchParams.get("error")).toBe("account_not_linked");
      expect(providerAccounts(h)).toHaveLength(0);
      expect(passwordAccounts(h)).toHaveLength(1);
      expect(h.rows.session ?? []).toHaveLength(0);
      expect(h.revoked).toEqual([]);
    });

    it("refuses to join Google to a staff account", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      const response = await h.continueWithGoogle("sam@example.com");
      expect(location(response).searchParams.get("error")).toBe("staff_social_sign_in_not_allowed");
      expect(providerAccounts(h)).toHaveLength(0);
      expect(h.rows.session ?? []).toHaveLength(0);
    });

    it("never joins on a provider email Google has not verified", async () => {
      h = await harness({});
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      const response = await h.continueWithGoogle("ada@example.com", { emailVerified: false });
      expect(location(response).searchParams.get("error")).toBe("account_not_linked");
      expect(providerAccounts(h)).toHaveLength(0);
      expect(h.rows.session ?? []).toHaveLength(0);
    });

    it("leaves the account exactly as it was when the join is refused", async () => {
      h = await harness({});
      await h.createAccount({
        id: "u1",
        email: "ada@example.com",
        emailVerified: true,
        twoFactorEnabled: true,
      });
      const before = JSON.stringify(h.rows.user);
      await h.continueWithGoogle("ada@example.com");
      expect(JSON.stringify(h.rows.user)).toBe(before);
    });
  });

  describe("SM14: staff accounts do not use Google or Apple", () => {
    it("refuses a staff sign-in even through a link made before the rule, and creates no session", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      await h.context.adapter.create({
        model: "account",
        data: {
          userId: "u1",
          providerId: "google",
          accountId: GOOGLE_SUB,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        forceAllowId: true,
      });
      const response = await h.continueWithGoogle("sam@example.com");
      expect(location(response).searchParams.get("error")).toBe("staff_social_sign_in_not_allowed");
      expect(h.rows.session ?? []).toHaveLength(0);
    });

    it("lets the same person sign in with a password as before", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      const session = await h.sessionFor("u1");
      expect(session.userId).toBe("u1");
    });
  });

  describe("audit records", () => {
    it("records that a staff link was refused", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      await h.continueWithGoogle("sam@example.com");
      expect(h.events).toEqual([
        {
          type: "user.social_link_refused_staff",
          userId: "u1",
          provider: "google",
          attempt: "link",
        },
      ]);
    });

    it("records that a staff sign-in through an older link was refused", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      await h.context.adapter.create({
        model: "account",
        data: {
          userId: "u1",
          providerId: "google",
          accountId: GOOGLE_SUB,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        forceAllowId: true,
      });
      await h.continueWithGoogle("sam@example.com");
      expect(h.events).toEqual([
        {
          type: "user.social_link_refused_staff",
          userId: "u1",
          provider: "google",
          attempt: "sign_in",
        },
      ]);
    });

    it("records the removal of an unconfirmed password, with the notice", async () => {
      h = await harness({});
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: false });
      await h.continueWithGoogle("ada@example.com");
      expect(h.events).toEqual([
        { type: "user.unconfirmed_password_removed", userId: "u1", provider: "google" },
      ]);
      expect(h.notices).toHaveLength(1);
    });

    it("writes nothing for an ordinary join, a refused two-step join or a first sign-up", async () => {
      h = await harness({});
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      await h.createAccount({
        id: "u2",
        email: "bo@example.com",
        emailVerified: true,
        twoFactorEnabled: true,
      });
      await h.continueWithGoogle("ada@example.com");
      await h.continueWithGoogle("bo@example.com");
      await h.continueWithGoogle("new@example.com");
      expect(h.events).toEqual([]);
    });

    it("still refuses a staff account when the audit record cannot be written", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      (h.ports.events as { publish: unknown }).publish = async () => {
        throw new Error("outbox unavailable");
      };
      const response = await h.continueWithGoogle("sam@example.com");
      expect(location(response).searchParams.get("error")).toBe("staff_social_sign_in_not_allowed");
      expect(providerAccounts(h)).toHaveLength(0);
    });
  });

  describe("a refused staff sign-in lands on the hosted page, not a raw 403", () => {
    it("is a redirect to the sign-in page that started it, with the code and no body to read", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: true });
      await h.context.adapter.create({
        model: "account",
        data: {
          userId: "u1",
          providerId: "google",
          accountId: GOOGLE_SUB,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        forceAllowId: true,
      });
      const response = await h.continueWithGoogle("sam@example.com");
      expect(response.status).toBe(302);
      const target = location(response);
      expect(`${target.origin}${target.pathname}`).toBe(`${BASE}/login`);
      expect(target.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(target.searchParams.get("error")).toBe("staff_social_sign_in_not_allowed");
      expect(await response.text()).toBe("");
    });
  });

  describe("when the identity policy cannot be read", () => {
    it("fails closed: no link and no session, and the failure is reported", async () => {
      h = await harness({ failPolicyRead: true });
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      const response = await h.continueWithGoogle("ada@example.com");
      expect(location(response).searchParams.get("error")).not.toBeNull();
      expect(providerAccounts(h)).toHaveLength(0);
      expect(h.rows.session ?? []).toHaveLength(0);
      expect(h.policyReadFailures).toHaveLength(1);
      expect(String(h.policyReadFailures[0])).toContain("identity database unavailable");
    });

    it("reports a failed read at sign-in through an existing link too", async () => {
      h = await harness({ failPolicyRead: true });
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      await h.context.adapter.create({
        model: "account",
        data: {
          userId: "u1",
          providerId: "google",
          accountId: GOOGLE_SUB,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        forceAllowId: true,
      });
      const response = await h.continueWithGoogle("ada@example.com");
      expect(response.status).toBe(302);
      expect(location(response).searchParams.get("error")).toBe("social_sign_in_unavailable");
      expect(h.rows.session ?? []).toHaveLength(0);
      expect(h.policyReadFailures.length).toBeGreaterThan(0);
    });

    it("does not touch a first sign-up, which reads no policy", async () => {
      h = await harness({ failPolicyRead: true });
      const response = await h.continueWithGoogle("new@example.com");
      expect(location(response).searchParams.get("error")).toBeNull();
      expect(h.rows.session).toHaveLength(1);
      expect(h.policyReadFailures).toEqual([]);
    });
  });

  describe("SM15: two-step verification applies after Google too", () => {
    async function linkedWithTwoStep() {
      h = await harness({});
      await h.createAccount({
        id: "u1",
        email: "ada@example.com",
        emailVerified: true,
        twoFactorEnabled: true,
      });
      await h.context.adapter.create({
        model: "account",
        data: {
          userId: "u1",
          providerId: "google",
          accountId: GOOGLE_SUB,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        forceAllowId: true,
      });
    }

    it("sends a person with two-step on to the code page and leaves no session behind", async () => {
      await linkedWithTwoStep();
      const response = await h.continueWithGoogle("ada@example.com");
      const target = location(response);
      expect(`${target.origin}${target.pathname}`).toBe(`${BASE}/two-factor`);
      expect(target.searchParams.get("callbackURL")).toBe(PRODUCT_LOGIN);
      expect(target.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(h.rows.session?.filter((row) => row.userId === "u1") ?? []).toHaveLength(0);
      const cookies = response.headers.getSetCookie?.() ?? [];
      expect(cookies.some((value) => /two_factor=/.test(value))).toBe(true);
      expect(cookies.some((value) => /session_token=;|session_token=.*Max-Age=0/.test(value))).toBe(
        true,
      );
    });

    it("does not hand over a session in the response either", async () => {
      await linkedWithTwoStep();
      const response = await h.continueWithGoogle("ada@example.com");
      const cookies = response.headers.getSetCookie?.() ?? [];
      const live = cookies.filter(
        (value) => /session_token=[^;]+/.test(value) && !/Max-Age=0/.test(value),
      );
      expect(live).toEqual([]);
    });
  });

  describe("SM5: a password set before the email was confirmed does not survive Google", () => {
    async function unconfirmedWithPassword() {
      h = await harness({});
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: false });
      // Sessions the person who registered the address first may hold.
      await h.sessionFor("u1");
      await h.sessionFor("u1");
    }

    it("joins Google, confirms the email, removes the password and ends the old sessions", async () => {
      await unconfirmedWithPassword();
      const response = await h.continueWithGoogle("ada@example.com");
      expect(location(response).searchParams.get("error")).toBeNull();
      expect(providerAccounts(h)).toHaveLength(1);
      expect(passwordAccounts(h)).toHaveLength(0);
      expect(h.rows.user?.[0]).toMatchObject({ emailVerified: true });
      expect(h.revoked).toEqual(["u1"]);
      // Only the session made by this Google sign-in is left.
      expect(h.rows.session).toHaveLength(1);
    });

    it("tells the person what was done", async () => {
      await unconfirmedWithPassword();
      await h.continueWithGoogle("ada@example.com");
      expect(h.notices).toEqual([
        expect.objectContaining({
          kind: "unconfirmed_password_removed",
          userId: "u1",
          provider: "google",
        }),
      ]);
    });

    it("sends no such notice when there was no password to remove", async () => {
      h = await harness({});
      await h.createAccount({
        id: "u1",
        email: "ada@example.com",
        emailVerified: false,
        withPassword: false,
      });
      await h.continueWithGoogle("ada@example.com");
      expect(h.rows.user?.[0]).toMatchObject({ emailVerified: true });
      expect(providerAccounts(h)).toHaveLength(1);
      expect(h.notices).toEqual([]);
    });

    it("keeps the password of an account whose email was confirmed", async () => {
      h = await harness({});
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
      await h.continueWithGoogle("ada@example.com");
      expect(passwordAccounts(h)).toHaveLength(1);
      expect(h.revoked).toEqual([]);
      expect(h.notices).toEqual([]);
    });

    it("stops the link when the old sessions cannot be ended, so the password never stands beside a verified email", async () => {
      h = await harness({
        revokeAllSessions: async () => {
          throw new Error("outbox unavailable");
        },
      });
      await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: false });
      const response = await h.continueWithGoogle("ada@example.com");
      expect(location(response).searchParams.get("error")).not.toBeNull();
      expect(providerAccounts(h)).toHaveLength(0);
      expect(passwordAccounts(h)).toHaveLength(1);
      expect(h.rows.session ?? []).toHaveLength(0);
      expect(h.rows.user?.[0]).toMatchObject({ emailVerified: false });
    });

    it("does nothing for an unconfirmed account when two-step is on or the person is staff", async () => {
      h = await harness({ staff: ["u1"] });
      await h.createAccount({ id: "u1", email: "sam@example.com", emailVerified: false });
      const staffResponse = await h.continueWithGoogle("sam@example.com");
      expect(location(staffResponse).searchParams.get("error")).toBe(
        "staff_social_sign_in_not_allowed",
      );
      expect(passwordAccounts(h)).toHaveLength(1);
      expect(h.revoked).toEqual([]);
    });
  });

  describe("a first Google sign-up is unchanged", () => {
    it("creates the account and signs the person in", async () => {
      h = await harness({});
      const response = await h.continueWithGoogle("new@example.com");
      expect(location(response).searchParams.get("error")).toBeNull();
      expect(h.rows.user).toHaveLength(1);
      expect(h.rows.user?.[0]).toMatchObject({ email: "new@example.com", emailVerified: true });
      expect(providerAccounts(h)).toHaveLength(1);
      expect(h.rows.session).toHaveLength(1);
    });
  });
});

describe("SM3: linking from Security", () => {
  beforeEach(async () => {
    h = await harness({});
    await h.createAccount({ id: "u1", email: "ada@example.com", emailVerified: true });
  });

  it("links a Google account with a different address, keeps that address and leaves the LAX email alone", async () => {
    const response = await h.linkFromSecurity("ada@example.com", {
      email: "ada.work@corp.example",
    });
    expect(location(response).pathname).toBe("/account-action/done");
    expect(location(response).searchParams.get("error")).toBeNull();
    const [linked] = providerAccounts(h);
    expect(linked).toMatchObject({
      userId: "u1",
      providerEmail: "ada.work@corp.example",
      providerEmailHidden: false,
    });
    expect(h.rows.user?.[0]).toMatchObject({ email: "ada@example.com", emailVerified: true });
  });

  it("marks Apple's private relay address as hidden", async () => {
    await h.linkFromSecurity("ada@example.com", {
      email: "abc123@privaterelay.appleid.com",
      is_private_email: "true",
    });
    expect(providerAccounts(h)[0]).toMatchObject({
      providerEmail: "abc123@privaterelay.appleid.com",
      providerEmailHidden: true,
    });
  });

  it("sends the one 'added' email and records one 'added' event, naming the method and address", async () => {
    // The row is written within seconds of the user's own, so age the user first: a link made
    // long after sign-up is what gets announced.
    const user = h.rows.user?.[0];
    if (user) user.createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await h.linkFromSecurity("ada@example.com", { email: "ada.work@corp.example" });
    expect(h.notices.filter((notice) => notice.kind === "sign_in_method_added")).toEqual([
      expect.objectContaining({
        kind: "sign_in_method_added",
        userId: "u1",
        method: "google",
        detail: "ada.work@corp.example",
      }),
    ]);
    expect(h.events.filter((event) => event.type === "user.sign_in_method_added")).toEqual([
      { type: "user.sign_in_method_added", userId: "u1", method: "google" },
    ]);
  });

  it("links through a form POST callback, as Apple answers, with the same result", async () => {
    const response = await h.linkFromSecurity(
      "ada@example.com",
      { email: "abc@privaterelay.appleid.com", is_private_email: "true" },
      { formPost: true },
    );
    const posted = h.formPostRedirect();
    expect(posted?.status).toBe(302);
    expect(new URL(posted?.headers.get("location") ?? "", BASE).pathname).toBe(
      "/api/auth/callback/google",
    );
    expect(location(response).pathname).toBe("/account-action/done");
    expect(location(response).searchParams.get("error")).toBeNull();
    expect(providerAccounts(h)[0]).toMatchObject({
      userId: "u1",
      providerEmail: "abc@privaterelay.appleid.com",
      providerEmailHidden: true,
    });
  });

  it("refuses a link that did not come through the hand-off, even from the person's own session", async () => {
    const response = await h.linkFromSecurity(
      "ada@example.com",
      { email: "attacker@evil.example" },
      { withoutMarker: true },
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("link_not_started_from_account");
    expect(providerAccounts(h)).toHaveLength(0);
    expect(h.notices.filter((notice) => notice.kind === "sign_in_method_added")).toEqual([]);
    expect(h.events.filter((event) => event.type === "user.sign_in_method_added")).toEqual([]);
  });

  it("refuses a marked link whose mark is not exactly true", async () => {
    const response = await h.linkFromSecurity(
      "ada@example.com",
      { email: "ada.work@corp.example" },
      { marker: "true" },
    );
    expect(response.status).toBe(403);
    expect(providerAccounts(h)).toHaveLength(0);
  });

  it("refuses a provider account already linked to someone else, and links nothing", async () => {
    await h.createAccount({ id: "u2", email: "bo@example.com", emailVerified: true });
    await h.linkFromSecurity("bo@example.com", { email: "bo@example.com" });
    const again = await h.linkFromSecurity("ada@example.com", { email: "ada@example.com" });
    expect(location(again).searchParams.get("error")).toBe(
      "account_already_linked_to_different_user",
    );
    expect(providerAccounts(h).map((row) => row.userId)).toEqual(["u2"]);
  });

  it("still never joins a different address at sign-in: only a link the person started may differ", async () => {
    const response = await h.continueWithGoogle("someone.else@example.com");
    expect(location(response).searchParams.get("error")).toBeNull();
    // A new Google sign-up makes its own account; it is not joined to ada's.
    expect(h.rows.user).toHaveLength(2);
    expect(providerAccounts(h).every((row) => row.userId !== "u1")).toBe(true);
  });

  it("refuses to link a provider account whose address the provider has not verified", async () => {
    const response = await h.linkFromSecurity("ada@example.com", {
      email: "ada.work@corp.example",
      email_verified: false,
    });
    expect(location(response).searchParams.get("error")).toBe("unable_to_link_account");
    expect(providerAccounts(h)).toHaveLength(0);
  });
});

describe("Better Auth's own link and unlink endpoints are not reachable", () => {
  it.each(["/api/auth/link-social", "/api/auth/unlink-account"])(
    "answers %s with not found",
    async (path) => {
      h = await harness({});
      const response = await h.auth.handler(
        new Request(`${BASE}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE },
          body: JSON.stringify({ provider: "google", providerId: "google" }),
        }),
      );
      expect(response.status).toBe(404);
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
