import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import type { LegalAcceptanceRecorder } from "../ports/legal-acceptance-recorder.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { buildUserDatabaseHooks } from "./user-hooks.js";

const oauthState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: async () => oauthState.current,
}));

function deps(recorder: LegalAcceptanceRecorder | undefined): AuthHookDeps {
  return {
    ports: {
      subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
      accountLinkReader: {
        countAccountsForUser: vi.fn(async () => 0),
        isEmailVerified: vi.fn(async () => true),
        findUserEmailProfile: vi.fn(async () => null),
      },
      phoneNumberStore: {
        purgeExpiredVerifications: vi.fn(async () => undefined),
        findPhoneNumber: vi.fn(async () => null),
        resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
      },
      email: undefined,
      securityNotices: undefined,
      ...(recorder ? { legalAcceptance: recorder } : {}),
    },
  };
}

function recorderDouble() {
  const recordSignUp = vi.fn(async () => undefined);
  return { recorder: { recordSignUp } satisfies LegalAcceptanceRecorder, recordSignUp };
}

const authUser = { id: "user-1", email: "a@example.com", name: "A", emailVerified: false };

describe("user.create.after records the statement shown at sign-up", () => {
  it("records a hosted email sign-up for the product on the page", async () => {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser, {
      path: "/sign-up/email",
      body: { legalAcceptance: { product: "bid" } },
    });
    expect(recordSignUp).toHaveBeenCalledWith({
      subjectId: "user-1",
      product: "bid",
      source: "hosted_sign_up",
    });
  });

  it("records a social sign-up from the state carried through the provider", async () => {
    oauthState.current = { legalAcceptance: { product: "shop" } };
    const { recorder, recordSignUp } = recorderDouble();
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser, {
      path: "/callback/:id",
    });
    expect(recordSignUp).toHaveBeenCalledWith({
      subjectId: "user-1",
      product: "shop",
      source: "social_sign_up",
    });
  });

  it("records nothing when the sign-up did not come from the sign-up page", async () => {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser, {
      path: "/callback/:id",
    });
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser);
    expect(recordSignUp).not.toHaveBeenCalled();
  });

  it("lets a failed record fail the sign-up", async () => {
    oauthState.current = null;
    const recorder = {
      recordSignUp: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    };
    await expect(
      buildUserDatabaseHooks(deps(recorder)).create.after(authUser, {
        path: "/sign-up/email",
        body: { legalAcceptance: { product: "art" } },
      }),
    ).rejects.toThrow("database unavailable");
  });
});

describe("email sign-up through Better Auth", () => {
  async function signUp(body: Record<string, unknown>) {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    const auth = betterAuth({
      secret: "test-secret-that-is-long-enough", // gitleaks:allow synthetic fixture secret
      baseURL: "http://localhost:3003",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      emailAndPassword: { enabled: true, autoSignIn: false },
      databaseHooks: { user: buildUserDatabaseHooks(deps(recorder)) },
    });
    const result = await auth.api.signUpEmail({
      body: {
        name: "Sarah",
        email: "sarah@example.com",
        password: "correct-horse-battery-staple-32", // gitleaks:allow synthetic fixture password
        ...body,
      },
    });
    return { userId: result.user.id, recordSignUp };
  }

  it("records the acceptance against the account it created", async () => {
    const { userId, recordSignUp } = await signUp({ legalAcceptance: { product: "account" } });
    expect(recordSignUp).toHaveBeenCalledTimes(1);
    expect(recordSignUp).toHaveBeenCalledWith({
      subjectId: userId,
      product: "account",
      source: "hosted_sign_up",
    });
  });

  it("records nothing for a sign-up that carries no statement", async () => {
    const { recordSignUp } = await signUp({});
    expect(recordSignUp).not.toHaveBeenCalled();
  });

  it("records nothing when an existing account signs in again", async () => {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    const auth = betterAuth({
      secret: "test-secret-that-is-long-enough",
      baseURL: "http://localhost:3003",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      emailAndPassword: { enabled: true, autoSignIn: false },
      databaseHooks: { user: buildUserDatabaseHooks(deps(recorder)) },
    });
    const credentials = {
      name: "Sarah",
      email: "sarah@example.com",
      password: "correct-horse-battery-staple-32", // gitleaks:allow synthetic fixture password
    };
    await auth.api.signUpEmail({
      body: { ...credentials, legalAcceptance: { product: "account" } },
    });
    expect(recordSignUp).toHaveBeenCalledTimes(1);
    recordSignUp.mockClear();
    await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });
    expect(recordSignUp).not.toHaveBeenCalled();
  });
});
