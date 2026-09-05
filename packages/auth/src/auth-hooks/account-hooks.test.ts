import { describe, expect, it, vi } from "vitest";
import { buildAccountDatabaseHooks } from "./account-hooks.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

function deps(onAccountCreated: NonNullable<AuthHookDeps["onAccountCreated"]>): AuthHookDeps {
  return {
    ports: {
      subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
      sessionCountReader: { countSessionsForUser: vi.fn(async () => 0) },
      accountLinkReader: {
        countAccountsForUser: vi.fn(async () => 1),
        isEmailVerified: vi.fn(async () => true),
        findUserEmailProfile: vi.fn(async () => null),
      },
      phoneNumberStore: {
        purgeExpiredVerifications: vi.fn(async () => undefined),
        findPhoneNumber: vi.fn(async () => null),
        resetPhoneVerifiedIfNumberChanged: vi.fn(async () => undefined),
      },
    },
    onAccountCreated,
  };
}

describe("account lifecycle hooks", () => {
  it("surfaces durable registration publication failures", async () => {
    const hooks = buildAccountDatabaseHooks(
      deps(vi.fn().mockRejectedValue(new Error("outbox unavailable"))),
    );

    await expect(
      hooks.create.after({
        userId: "subject-1",
        providerId: "credential",
        createdAt: new Date("2026-09-05T00:00:00Z"),
      }),
    ).rejects.toThrow("outbox unavailable");
  });
});
