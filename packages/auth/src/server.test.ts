import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import type { AuthDatabase } from "./phone-number-plugin.js";
import type { AccountLinkReader, AuthPorts, PhoneNumberStore } from "./ports/index.js";
import {
  assertCanUnlinkAccount,
  createAuth,
  createSocialProviders,
  shouldBlockLastAccountUnlink,
  shouldNotifySocialAccountLinked,
} from "./server.js";

function mockAuthDatabase(): AuthDatabase {
  const adapter = {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => callback(adapter)),
  };
  return (() => adapter) as AuthDatabase;
}

function mockAccountLinkReader(options: {
  accountRows: number;
  emailVerified: boolean | null;
}): AccountLinkReader {
  return {
    countAccountsForUser: vi.fn().mockResolvedValue(options.accountRows),
    isEmailVerified: vi.fn().mockResolvedValue(options.emailVerified),
    findUserEmailProfile: vi.fn(),
  };
}

function mockPhoneNumberStore(): PhoneNumberStore {
  return {
    purgeExpiredVerifications: vi.fn(async () => undefined),
    findPhoneNumber: vi.fn(async () => null),
    resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
  };
}

function mockAuthPorts(overrides?: Partial<AuthPorts>): AuthPorts {
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
    },
    subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
    accountLinkReader: mockAccountLinkReader({ accountRows: 0, emailVerified: true }),
    sessionCountReader: { countSessionsForUser: vi.fn(async () => 0) },
    phoneNumberStore: mockPhoneNumberStore(),
    email: undefined,
    sms: undefined,
    events: undefined,
    ...overrides,
  };
}

describe("createAuth", () => {
  it("boots when Apple Sign-In is feature-flagged off", () => {
    expect(() =>
      createAuth({
        database: mockAuthDatabase(),
        ports: mockAuthPorts(),
        secret: "test-secret-that-is-long-enough",
        baseURL: "http://localhost:3001",
        issuerURL: "http://localhost:3001",
        appleClientId: undefined,
        appleClientSecret: undefined,
      }),
    ).not.toThrow();
  });

  it("boots with host-only issuer cookies", () => {
    expect(() =>
      createAuth({
        database: mockAuthDatabase(),
        ports: mockAuthPorts(),
        secret: "test-secret-that-is-long-enough",
        baseURL: "https://auth.example.com",
      }),
    ).not.toThrow();
  });

  it("registers Google and Apple providers when credentials are configured", () => {
    expect(
      createSocialProviders({
        googleClientId: "google-client-id",
        googleClientSecret: "google-client-secret",
        appleClientId: "apple-client-id",
        appleClientSecret: "apple-client-secret",
      }),
    ).toEqual({
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      },
      apple: {
        clientId: "apple-client-id",
        clientSecret: "apple-client-secret",
      },
    });
  });
});

describe("shouldNotifySocialAccountLinked", () => {
  it("returns false when account is created with the user (social sign-up)", () => {
    const createdAt = new Date("2026-01-01T12:00:00.000Z");
    expect(
      shouldNotifySocialAccountLinked({
        userCreatedAt: createdAt,
        accountCreatedAt: createdAt,
      }),
    ).toBe(false);
  });

  it("returns true when the user existed before the social account row (link action)", () => {
    expect(
      shouldNotifySocialAccountLinked({
        userCreatedAt: "2026-01-01T12:00:00.000Z",
        accountCreatedAt: "2026-06-01T12:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("returns false when the account predates the user (invalid timestamps)", () => {
    expect(
      shouldNotifySocialAccountLinked({
        userCreatedAt: "2026-06-01T12:00:00.000Z",
        accountCreatedAt: "2026-01-01T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("shouldBlockLastAccountUnlink", () => {
  it("does not block when multiple account rows remain", async () => {
    expect(
      await shouldBlockLastAccountUnlink({
        accounts: mockAccountLinkReader({ accountRows: 2, emailVerified: false }),
        userId: "u1",
        accountRowsForUser: 2,
      }),
    ).toBe(false);
  });

  it("blocks last account row removal when email is not verified", async () => {
    expect(
      await shouldBlockLastAccountUnlink({
        accounts: mockAccountLinkReader({ accountRows: 1, emailVerified: false }),
        userId: "u1",
        accountRowsForUser: 1,
      }),
    ).toBe(true);
  });

  it("allows last account row removal when email is verified (magic link remains)", async () => {
    expect(
      await shouldBlockLastAccountUnlink({
        accounts: mockAccountLinkReader({ accountRows: 1, emailVerified: true }),
        userId: "u1",
        accountRowsForUser: 1,
      }),
    ).toBe(false);
  });
});

describe("assertCanUnlinkAccount (delete.before guard)", () => {
  it("throws a FAILED_TO_UNLINK_LAST_ACCOUNT APIError for the last method of an unverified user", async () => {
    const accounts = mockAccountLinkReader({ accountRows: 1, emailVerified: false });

    await expect(assertCanUnlinkAccount({ accounts, userId: "u1" })).rejects.toBeInstanceOf(
      APIError,
    );
    await expect(assertCanUnlinkAccount({ accounts, userId: "u1" })).rejects.toMatchObject({
      body: { code: "FAILED_TO_UNLINK_LAST_ACCOUNT" },
    });
  });

  it("resolves (allows unlink) when another account row remains", async () => {
    const accounts = mockAccountLinkReader({ accountRows: 2, emailVerified: false });

    await expect(assertCanUnlinkAccount({ accounts, userId: "u1" })).resolves.toBeUndefined();
  });

  it("resolves for the last account row when email is verified (magic link remains)", async () => {
    const accounts = mockAccountLinkReader({ accountRows: 1, emailVerified: true });

    await expect(assertCanUnlinkAccount({ accounts, userId: "u1" })).resolves.toBeUndefined();
  });
});
