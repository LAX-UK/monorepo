import { describe, expect, it, vi } from "vitest";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import { buildUserDatabaseHooks } from "./user-hooks.js";

function createDeps(onUserUpdated: NonNullable<AuthHookDeps["onUserUpdated"]>): AuthHookDeps {
  return {
    ports: {
      subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
      sessionCountReader: { countSessionsForUser: vi.fn(async () => 0) },
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
    },
    onUserUpdated,
  };
}

describe("user profile update hooks", () => {
  it("publishes image-only profile updates including image removal", async () => {
    const onUserUpdated = vi.fn(async () => undefined);
    const hooks = buildUserDatabaseHooks(createDeps(onUserUpdated));

    await hooks.update.before({ id: "subject-1", image: null });
    await hooks.update.after({
      id: "subject-1",
      email: "user@example.com",
      name: "User",
      phoneNumber: null,
      image: null,
    });

    expect(onUserUpdated).toHaveBeenCalledWith({
      id: "subject-1",
      email: "user@example.com",
      name: "User",
      phoneNumber: null,
      image: null,
    });
  });

  it("does not collapse concurrent profile updates for the same subject", async () => {
    const onUserUpdated = vi.fn(async () => undefined);
    const hooks = buildUserDatabaseHooks(createDeps(onUserUpdated));
    const updated = {
      id: "subject-1",
      email: "user@example.com",
      name: "User",
      phoneNumber: "+441234567890",
      image: null,
    };

    await hooks.update.before({ id: "subject-1", name: "First" });
    await hooks.update.before({ id: "subject-1", phoneNumber: "+441234567890" });
    await hooks.update.after(updated);
    await hooks.update.after(updated);

    expect(onUserUpdated).toHaveBeenCalledTimes(2);
  });
});
