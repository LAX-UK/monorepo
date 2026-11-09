import { beforeEach, describe, expect, it, vi } from "vitest";

const oauthState = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: async () => oauthState.current,
}));

import { buildAccountDatabaseHooks } from "./account-hooks.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";

function deps(onAccountCreated: NonNullable<AuthHookDeps["onAccountCreated"]>): AuthHookDeps {
  return {
    ports: {
      subjectStatusReader: { isDisabledOrMerged: vi.fn(async () => false) },
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

describe("a hand-off link for a staff account", () => {
  beforeEach(() => {
    // A link the issuer's hand-off started, carrying its mark.
    oauthState.current = {
      link: { userId: "staff-1", email: "staff@example.com" },
      accountAction: true,
    };
  });

  function staffDeps() {
    const base = deps(vi.fn());
    const publish = vi.fn(async () => undefined);
    return {
      publish,
      deps: {
        ...base,
        ports: {
          ...base.ports,
          events: { publish },
          twoFactorPolicyStore: {
            readSubjectPolicyInputs: vi.fn(async () => ({
              markers: [{ kind: "staff", product: "bid" }],
            })),
            readTwoFactorEnabled: vi.fn(async () => new Map([["staff-1", true]])),
          },
        },
      } as unknown as AuthHookDeps,
    };
  }

  it("is refused before the provider account is written, and the refusal is recorded", async () => {
    const { deps: staff, publish } = staffDeps();
    const hooks = buildAccountDatabaseHooks(staff);

    await expect(
      hooks.create.before({ userId: "staff-1", providerId: "google" }, { context: {} }),
    ).rejects.toMatchObject({ body: { code: "staff_social_sign_in_not_allowed" } });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "user.social_link_refused_staff", userId: "staff-1" }),
    );
  });

  it("is refused on the library's ID-token link path whatever the mark says", async () => {
    const { deps: staff } = staffDeps();
    const hooks = buildAccountDatabaseHooks(staff);

    await expect(
      hooks.create.before(
        { userId: "staff-1", providerId: "google" },
        { path: "/link-social", context: {} },
      ),
    ).rejects.toMatchObject({ body: { code: "link_not_started_from_account" } });
  });
});
