import { randomUUID } from "node:crypto";
import {
  type Auth,
  type AuthPorts,
  type CredentialEmailInput,
  createAuth,
  decideAuthorizeTwoFactorStep,
} from "@auction/auth";
import { createIdentityAuthPorts, createIdentityDb } from "@auction/identity-db";
import { account, session, user, verification } from "@auction/identity-db/schema";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createTwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";
import { buildDrizzleDatabase } from "./build-drizzle-database.js";

/**
 * A person who only ever signed in with Google or Apple has no password. Completing
 * "Email me a link" must give them a password sign-in (a `credential` account holding a hash),
 * and once they turn two-step on, that sign-in must ask for the authenticator code.
 * Runs the real Better Auth handler against Postgres, with the reset email captured in memory.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = "http://localhost:3001";
// Generated per run so no fixed credential lives in the repository.
const NEW_PASSWORD = `Pw-${randomUUID()}`;

type Sink = { sent: CredentialEmailInput[] };

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

function postJson(auth: Auth, path: string, body: unknown, cookie?: string): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
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

describe.skipIf(!DATABASE_URL)("password reset for a social-only person", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (!db || createdUserIds.length === 0) return;
    await db.delete(verification).where(inArray(verification.value, createdUserIds));
    await db.delete(user).where(inArray(user.id, createdUserIds));
  });

  function buildHarness(options: { orgTwoFactorRequired: boolean }) {
    if (!db) throw new Error("DATABASE_URL is required");
    const sink: Sink = { sent: [] };
    const identityPorts = createIdentityAuthPorts(db);
    const ports: AuthPorts = {
      ...identityPorts,
      email: undefined,
      securityNotices: { notify: async () => undefined },
      sms: undefined,
      events: undefined,
      credentialEmail: {
        send: async (input) => {
          sink.sent.push(input);
        },
      },
      ...(options.orgTwoFactorRequired
        ? {
            twoFactorPolicyStore: {
              ...identityPorts.twoFactorPolicyStore,
              readSubjectPolicyInputs: async () => ({
                markers: [{ kind: "org_member" as const, legalEntityId: "org-reset-test" }],
                policies: [
                  { scope: "org" as const, legalEntityId: "org-reset-test", required: true },
                ],
              }),
            },
          }
        : {}),
    };
    const auth = createAuth({
      database: buildDrizzleDatabase(db),
      ports,
      secret: "sm1b-reset-credential-test-secret-0123456789",
      baseURL: BASE_URL,
      issuerURL: BASE_URL,
      allowInsecureCookies: true,
    });
    return { auth, ports, sink };
  }

  async function createSocialOnlyUser(): Promise<{ id: string; email: string }> {
    if (!db) throw new Error("DATABASE_URL is required");
    const id = randomUUID();
    const email = `sm1b-${id}@example.test`;
    const now = new Date();
    createdUserIds.push(id);
    await db.insert(user).values({
      id,
      name: "Social Only",
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

  async function accountsOf(userId: string) {
    if (!db) throw new Error("DATABASE_URL is required");
    return db
      .select({ providerId: account.providerId, hasPassword: account.password })
      .from(account)
      .where(eq(account.userId, userId));
  }

  async function resetThroughEmailedLink(auth: Auth, sink: Sink, email: string): Promise<void> {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${BASE_URL}/reset-password` },
    });
    expect(sink.sent).toHaveLength(1);
    const mail = sink.sent[0];
    expect(mail?.template).toBe("reset-password");
    expect(mail?.to).toBe(email);
    const resetLink = String(mail?.vars.resetLink);
    const token = new URL(resetLink).pathname.split("/").pop();
    expect(token).toBeTruthy();
    const response = await postJson(auth, "/reset-password", { newPassword: NEW_PASSWORD, token });
    expect(response.status).toBe(200);
  }

  it("creates a credential account with a hashed password and allows password sign-in", async () => {
    const { auth, sink } = buildHarness({ orgTwoFactorRequired: false });
    const person = await createSocialOnlyUser();

    expect((await accountsOf(person.id)).map((row) => row.providerId)).toEqual(["google"]);
    const before = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: NEW_PASSWORD,
    });
    expect(before.status).not.toBe(200);

    await resetThroughEmailedLink(auth, sink, person.email);

    const rows = await accountsOf(person.id);
    expect(rows.map((row) => row.providerId).sort()).toEqual(["credential", "google"]);
    const credential = rows.find((row) => row.providerId === "credential");
    expect(typeof credential?.hasPassword).toBe("string");
    expect(credential?.hasPassword).not.toBe(NEW_PASSWORD);
    expect((credential?.hasPassword ?? "").length).toBeGreaterThan(32);
    // The linked Google account is left without a password.
    expect(rows.find((row) => row.providerId === "google")?.hasPassword).toBeNull();

    const signIn = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: NEW_PASSWORD,
    });
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { twoFactorRedirect?: boolean; token?: string };
    expect(body.twoFactorRedirect).toBeFalsy();
    expect(body.token).toBeTruthy();
    if (!db) throw new Error("DATABASE_URL is required");
    const sessions = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.userId, person.id)));
    expect(sessions.length).toBeGreaterThan(0);

    const wrong = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: `${NEW_PASSWORD}-wrong`,
    });
    expect(wrong.status).not.toBe(200);
  });

  it("asks a person who turns two-step on after the reset for the authenticator code at password sign-in", async () => {
    const { auth, sink } = buildHarness({ orgTwoFactorRequired: true });
    const person = await createSocialOnlyUser();

    await resetThroughEmailedLink(auth, sink, person.email);
    expect((await accountsOf(person.id)).map((row) => row.providerId).sort()).toEqual([
      "credential",
      "google",
    ]);

    // Having a password is what lets the person turn two-step on; enrol a real authenticator.
    const first = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: NEW_PASSWORD,
    });
    expect(first.status).toBe(200);
    const cookie = cookieHeader(first);
    const enable = await postJson(auth, "/two-factor/enable", { password: NEW_PASSWORD }, cookie);
    expect(enable.status).toBe(200);
    const { totpURI } = (await enable.json()) as { totpURI: string };
    const encoded = new URL(totpURI).searchParams.get("secret");
    expect(encoded).toBeTruthy();
    const secret = new TextDecoder().decode(base32.decode(encoded ?? ""));
    const verify = await postJson(
      auth,
      "/two-factor/verify-totp",
      { code: await createOTP(secret).totp() },
      cookie,
    );
    expect(verify.status).toBe(200);

    // A new password sign-in now stops at the challenge: no session, a pending two-step cookie.
    const challenged = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: NEW_PASSWORD,
    });
    expect(challenged.status).toBe(200);
    const challengedBody = (await challenged.json()) as {
      twoFactorRedirect?: boolean;
      token?: string;
    };
    expect(challengedBody.twoFactorRedirect).toBe(true);
    expect(challengedBody.token).toBeUndefined();
    expect(cookieHeader(challenged)).toContain("two_factor");
    await expect(
      auth.api.getSession({ headers: new Headers({ cookie: cookieHeader(challenged) }) }),
    ).resolves.toBeNull();
  });

  it("sends an organisation member who has not enrolled to two-step setup after a password sign-in", async () => {
    const { auth, ports, sink } = buildHarness({ orgTwoFactorRequired: true });
    const person = await createSocialOnlyUser();
    await resetThroughEmailedLink(auth, sink, person.email);

    // Nothing to challenge: the password sign-in succeeds and the person has not enrolled.
    const signIn = await postJson(auth, "/sign-in/email", {
      email: person.email,
      password: NEW_PASSWORD,
    });
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { twoFactorRedirect?: boolean };
    expect(body.twoFactorRedirect).toBeFalsy();
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader(signIn) }),
    });
    expect(session).not.toBeNull();
    expect(session?.user?.id).toBe(person.id);
    expect(session?.user?.twoFactorEnabled).toBeFalsy();

    // The organisation's policy, read through the issuer's requirement service, decides the step.
    const requirement = await createTwoFactorRequirementReader(ports.twoFactorPolicyStore)(
      person.id,
    );
    expect(requirement).toEqual({
      required: true,
      sources: [{ scope: "org", legalEntityId: "org-reset-test" }],
    });
    expect(
      decideAuthorizeTwoFactorStep({
        requestsSilver: false,
        requiredByPolicy: requirement.required,
        mfaCompletedAt: null,
        twoFactorEnabled: Boolean(session?.user?.twoFactorEnabled),
        canEnrolTotp: true,
      }),
    ).toBe("setup");
  });
});
