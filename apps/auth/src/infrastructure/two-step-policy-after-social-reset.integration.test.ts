import { randomUUID } from "node:crypto";
import { type Auth, type AuthPorts, createAuth } from "@auction/auth";
import { AUTH_ROUTE_PATH } from "@auction/identity-contracts";
import { createIdentityAuthPorts, createIdentityDb } from "@auction/identity-db";
import { account, session, user, verification } from "@auction/identity-db/schema";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { createTwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";
import { buildDrizzleDatabase } from "./build-drizzle-database.js";
import { DrizzleOidcRpSessionRepository } from "./oidc-session-adapters.js";
import { createTwoFactorAuthorizeGateMiddleware } from "./two-factor-authorize-gate.middleware.js";

/**
 * An organisation member whose organisation requires two-step sign-in, after a social-only
 * password reset. The real authorize gate runs against Postgres and a real Better Auth
 * session: a member who is not enrolled is sent to set up two-step and never reaches
 * `/oauth2/authorize`; an enrolled member is sent to the code challenge; and when the
 * organisation does not require two-step the request goes through.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = "http://localhost:3001";
const ORG_ID = "org-two-step-policy-test";
const REDIRECT = "https://shop-admin.test/api/auth/callback";
const NEW_PASSWORD = `Pw-${randomUUID()}`;

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

function postJson(auth: Auth, path: string, body: unknown, cookie?: string): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}${AUTH_ROUTE_PATH}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe.skipIf(!DATABASE_URL)("organisation two-step policy after a social-only reset", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (!db || createdUserIds.length === 0) return;
    await db.delete(verification).where(inArray(verification.value, createdUserIds));
    await db.delete(user).where(inArray(user.id, createdUserIds));
  });

  function harness(options: { required: boolean }) {
    if (!db) throw new Error("DATABASE_URL is required");
    const resetLinks: string[] = [];
    const identityPorts = createIdentityAuthPorts(db);
    const store = {
      ...identityPorts.twoFactorPolicyStore,
      readSubjectPolicyInputs: async () => ({
        markers: [{ kind: "org_member" as const, legalEntityId: ORG_ID }],
        policies: [{ scope: "org" as const, legalEntityId: ORG_ID, required: options.required }],
      }),
    };
    const ports: AuthPorts = {
      ...identityPorts,
      email: undefined,
      securityNotices: { notify: async () => undefined },
      sms: undefined,
      events: undefined,
      credentialEmail: {
        send: async (input) => {
          resetLinks.push(String(input.vars.resetLink));
        },
      },
      twoFactorPolicyStore: store,
    };
    const auth = createAuth({
      database: buildDrizzleDatabase(db),
      ports,
      secret: "sm1b-reset-credential-test-secret-0123456789",
      baseURL: BASE_URL,
      issuerURL: BASE_URL,
      allowInsecureCookies: true,
    });
    const app = new Hono();
    app.use(
      `${AUTH_ROUTE_PATH}/*`,
      createTwoFactorAuthorizeGateMiddleware({
        auth,
        db,
        sessions: new DrizzleOidcRpSessionRepository(db),
        readRequirement: createTwoFactorRequirementReader(store),
        issuerOrigin: BASE_URL,
      }),
    );
    app.get(`${AUTH_ROUTE_PATH}/oauth2/authorize`, (c) => c.text("authorized"));
    return { auth, app, resetLinks };
  }

  async function createSocialOnlyUser(): Promise<{ id: string; email: string }> {
    if (!db) throw new Error("DATABASE_URL is required");
    const id = randomUUID();
    const email = `sm1c-${id}@example.test`;
    const now = new Date();
    createdUserIds.push(id);
    await db.insert(user).values({
      id,
      name: "Organisation Member",
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: `google-${id}`,
      providerId: "google",
      userId: id,
      createdAt: now,
      updatedAt: now,
    });
    return { id, email };
  }

  /** Reset the password from the emailed link, then sign in with it; returns the session cookie. */
  async function resetAndSignIn(h: ReturnType<typeof harness>, email: string): Promise<string> {
    await h.auth.api.requestPasswordReset({
      body: { email, redirectTo: `${BASE_URL}/reset-password` },
    });
    expect(h.resetLinks).toHaveLength(1);
    const token = new URL(h.resetLinks[0] ?? "").pathname.split("/").pop();
    const reset = await postJson(h.auth, "/reset-password", { newPassword: NEW_PASSWORD, token });
    expect(reset.status).toBe(200);
    const signIn = await postJson(h.auth, "/sign-in/email", { email, password: NEW_PASSWORD });
    expect(signIn.status).toBe(200);
    return cookieHeader(signIn);
  }

  /** Enrols a real authenticator; returns the session cookie the verification issued. */
  async function enrolAuthenticator(
    h: ReturnType<typeof harness>,
    cookie: string,
  ): Promise<string> {
    const enable = await postJson(h.auth, "/two-factor/enable", { password: NEW_PASSWORD }, cookie);
    expect(enable.status).toBe(200);
    const { totpURI } = (await enable.json()) as { totpURI: string };
    const secret = new TextDecoder().decode(
      base32.decode(new URL(totpURI).searchParams.get("secret") ?? ""),
    );
    const verify = await postJson(
      h.auth,
      "/two-factor/verify-totp",
      { code: await createOTP(secret).totp() },
      cookie,
    );
    expect(verify.status).toBe(200);
    return cookieHeader(verify) || cookie;
  }

  function authorize(h: ReturnType<typeof harness>, cookie: string): Promise<Response> {
    const params = new URLSearchParams({
      client_id: "lax-shop-admin",
      redirect_uri: REDIRECT,
      response_type: "code",
      state: "state-1",
    });
    return Promise.resolve(
      h.app.request(`${BASE_URL}${AUTH_ROUTE_PATH}/oauth2/authorize?${params}`, {
        headers: { cookie },
      }),
    );
  }

  /** A fresh sign-in that has not completed a second step. */
  async function clearSecondStep(userId: string): Promise<void> {
    if (!db) throw new Error("DATABASE_URL is required");
    await db.update(session).set({ mfaCompletedAt: null }).where(eq(session.userId, userId));
  }

  it("sends a member who has not enrolled to two-step setup and does not authorize", async () => {
    const h = harness({ required: true });
    const person = await createSocialOnlyUser();
    const cookie = await resetAndSignIn(h, person.email);

    const response = await authorize(h, cookie);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe(BASE_URL);
    expect(location.pathname).toBe("/two-factor/setup");
    expect(location.searchParams.get("required_by")).toBe("org");
    expect(location.searchParams.get("client_id")).toBe("lax-shop-admin");
    expect(await response.text()).not.toBe("authorized");
  });

  it("asks an enrolled member for the code instead of authorizing", async () => {
    const h = harness({ required: true });
    const person = await createSocialOnlyUser();
    const signedIn = await resetAndSignIn(h, person.email);
    const cookie = await enrolAuthenticator(h, signedIn);
    await clearSecondStep(person.id);

    const response = await authorize(h, cookie);
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/two-factor");
  });

  it("lets the member through when the organisation does not require two-step", async () => {
    const h = harness({ required: false });
    const person = await createSocialOnlyUser();
    const cookie = await resetAndSignIn(h, person.email);

    const response = await authorize(h, cookie);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("authorized");
  });
});
