import type { Database } from "@auction/db";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import {
  assertCanUnlinkAccount,
  createAuth,
  createSocialProviders,
  shouldBlockLastAccountUnlink,
  shouldNotifySocialAccountLinked,
} from "./server.js";

/** Minimal Drizzle-shaped stub: `select().from().where()` resolves to the
 * account-row count, and `query.user.findFirst` returns the email state. */
function mockUnlinkDb(options: {
  accountRows: number;
  emailVerified: boolean | null;
}): Database {
  const whereResult = Promise.resolve([{ value: options.accountRows }]);
  return {
    select: () => ({
      from: () => ({
        where: () => whereResult,
      }),
    }),
    query: {
      user: {
        findFirst: async () =>
          options.emailVerified === null ? undefined : { emailVerified: options.emailVerified },
      },
    },
  } as unknown as Database;
}

describe("createAuth", () => {
  it("boots when Apple Sign-In is feature-flagged off", () => {
    expect(() =>
      createAuth({
        db: {} as Database,
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
        db: {} as Database,
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
        db: {} as Database,
        userId: "u1",
        accountRowsForUser: 2,
      }),
    ).toBe(false);
  });

  it("blocks last account row removal when email is not verified", async () => {
    const db = {
      query: {
        user: {
          findFirst: async () => ({ emailVerified: false }),
        },
      },
    } as unknown as Database;

    expect(
      await shouldBlockLastAccountUnlink({
        db,
        userId: "u1",
        accountRowsForUser: 1,
      }),
    ).toBe(true);
  });

  it("allows last account row removal when email is verified (magic link remains)", async () => {
    const db = {
      query: {
        user: {
          findFirst: async () => ({ emailVerified: true }),
        },
      },
    } as unknown as Database;

    expect(
      await shouldBlockLastAccountUnlink({
        db,
        userId: "u1",
        accountRowsForUser: 1,
      }),
    ).toBe(false);
  });
});

describe("assertCanUnlinkAccount (delete.before guard)", () => {
  it("throws a FAILED_TO_UNLINK_LAST_ACCOUNT APIError for the last method of an unverified user", async () => {
    const db = mockUnlinkDb({ accountRows: 1, emailVerified: false });

    await expect(assertCanUnlinkAccount({ db, userId: "u1" })).rejects.toBeInstanceOf(APIError);
    await expect(assertCanUnlinkAccount({ db, userId: "u1" })).rejects.toMatchObject({
      body: { code: "FAILED_TO_UNLINK_LAST_ACCOUNT" },
    });
  });

  it("resolves (allows unlink) when another account row remains", async () => {
    const db = mockUnlinkDb({ accountRows: 2, emailVerified: false });

    await expect(assertCanUnlinkAccount({ db, userId: "u1" })).resolves.toBeUndefined();
  });

  it("resolves for the last account row when email is verified (magic link remains)", async () => {
    const db = mockUnlinkDb({ accountRows: 1, emailVerified: true });

    await expect(assertCanUnlinkAccount({ db, userId: "u1" })).resolves.toBeUndefined();
  });
});
