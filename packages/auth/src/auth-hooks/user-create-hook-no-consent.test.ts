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

describe("user.create.after leaves the record to the database adapter", () => {
  it("does not write the record itself, so it cannot be written outside the user's transaction", async () => {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser);
    await buildUserDatabaseHooks(deps(recorder)).create.after(authUser);
    expect(recordSignUp).not.toHaveBeenCalled();
  });
});

describe("email sign-up through Better Auth", () => {
  it("does not record from the hook; the adapter writes it with the user row", async () => {
    oauthState.current = null;
    const { recorder, recordSignUp } = recorderDouble();
    const auth = betterAuth({
      secret: "test-secret-that-is-long-enough", // gitleaks:allow synthetic fixture secret
      baseURL: "http://localhost:3003",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      emailAndPassword: { enabled: true, autoSignIn: false },
      databaseHooks: { user: buildUserDatabaseHooks(deps(recorder)) },
    });
    await auth.api.signUpEmail({
      body: {
        name: "Sarah",
        email: "sarah@example.com",
        password: "correct-horse-battery-staple-32", // gitleaks:allow synthetic fixture password
        legalAcceptance: { product: "account" },
      },
    });
    expect(recordSignUp).not.toHaveBeenCalled();
  });
});
