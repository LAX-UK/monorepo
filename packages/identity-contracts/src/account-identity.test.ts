import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAME_MAX_LENGTH,
  accountNameSchema,
  accountProfileSchema,
} from "./account-profile.js";
import {
  ACCOUNT_STEP_UP_MAX_AGE_SECONDS,
  accountSessionsRevokedSchema,
  accountSessionsSchema,
} from "./account-sessions.js";

describe("accountNameSchema", () => {
  it("trims the name", () => {
    expect(accountNameSchema.parse("  Ada King ")).toBe("Ada King");
  });

  it("rejects an empty or whitespace-only name and one over the limit", () => {
    expect(accountNameSchema.safeParse("   ").success).toBe(false);
    expect(accountNameSchema.safeParse("a".repeat(ACCOUNT_NAME_MAX_LENGTH)).success).toBe(true);
    expect(accountNameSchema.safeParse("a".repeat(ACCOUNT_NAME_MAX_LENGTH + 1)).success).toBe(
      false,
    );
  });

  it("parses the profile response", () => {
    expect(accountProfileSchema.parse({ name: "Ada" })).toEqual({ name: "Ada" });
  });
});

describe("account sessions contract", () => {
  const session = {
    id: "s1",
    userAgent: null,
    createdAt: "2026-10-23T12:00:00.000Z",
    lastActiveAt: "2026-10-23T12:05:00+00:00",
    isCurrent: true,
  };

  it("accepts a session list and strips fields the contract does not name", () => {
    const parsed = accountSessionsSchema.parse({
      sessions: [{ ...session, ipAddress: "203.0.113.9", token: "secret" }],
    });
    expect(parsed.sessions[0]).toEqual(session);
  });

  it("rejects a session with a malformed time", () => {
    expect(
      accountSessionsSchema.safeParse({ sessions: [{ ...session, createdAt: "yesterday" }] })
        .success,
    ).toBe(false);
  });

  it("counts revoked sessions as a non-negative integer", () => {
    expect(accountSessionsRevokedSchema.safeParse({ revoked: 0 }).success).toBe(true);
    expect(accountSessionsRevokedSchema.safeParse({ revoked: -1 }).success).toBe(false);
    expect(accountSessionsRevokedSchema.safeParse({ revoked: 1.5 }).success).toBe(false);
  });

  it("keeps the step-up window at five minutes, matching the sign-in link's max_age", () => {
    expect(ACCOUNT_STEP_UP_MAX_AGE_SECONDS).toBe(300);
  });
});
