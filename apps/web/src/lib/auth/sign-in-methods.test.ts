import type { ConnectedAccountsState } from "@/lib/auth/hooks/use-connected-accounts";
import { describe, expect, it } from "vitest";
import { computeSignInMethods } from "./sign-in-methods";

const emptyState: ConnectedAccountsState = {
  accounts: [],
  hasPassword: false,
  google: null,
  apple: null,
  totalMethods: 0,
};

describe("computeSignInMethods", () => {
  it("counts magic link for verified email users with no account rows", () => {
    const result = computeSignInMethods({ state: emptyState, emailVerified: true });

    expect(result.totalMethods).toBe(1);
    expect(result.magicLinkAvailable).toBe(true);
    expect(result.methods).toEqual(["magicLink"]);
  });

  it("allows unlinking the only social provider when magic link remains", () => {
    const result = computeSignInMethods({
      state: {
        ...emptyState,
        google: {
          id: "g1",
          accountId: "ga",
          providerId: "google",
          createdAt: "",
          updatedAt: "",
          scopes: [],
        },
        totalMethods: 1,
      },
      emailVerified: true,
    });

    expect(result.totalMethods).toBe(2);
    expect(result.canUnlink("google")).toBe(true);
    expect(result.remainingSignInMethodLabels("google")).toEqual(["Email sign-in link"]);
  });

  it("blocks unlink when it would remove the last sign-in method", () => {
    const result = computeSignInMethods({
      state: {
        ...emptyState,
        google: {
          id: "g1",
          accountId: "ga",
          providerId: "google",
          createdAt: "",
          updatedAt: "",
          scopes: [],
        },
        totalMethods: 1,
      },
      emailVerified: false,
    });

    expect(result.totalMethods).toBe(1);
    expect(result.canUnlink("google")).toBe(false);
  });

  it("counts password, social, and magic link together", () => {
    const result = computeSignInMethods({
      state: {
        accounts: [],
        hasPassword: true,
        google: {
          id: "g1",
          accountId: "ga",
          providerId: "google",
          createdAt: "",
          updatedAt: "",
          scopes: [],
        },
        apple: null,
        totalMethods: 2,
      },
      emailVerified: true,
    });

    expect(result.totalMethods).toBe(3);
    expect(result.canUnlink("google")).toBe(true);
    expect(result.remainingSignInMethodLabels("google")).toEqual([
      "Email sign-in link",
      "Email and password",
    ]);
  });
});
