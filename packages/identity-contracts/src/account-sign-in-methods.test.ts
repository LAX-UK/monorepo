import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SIGN_IN_METHODS_PATH,
  ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
  ACCOUNT_SIGN_IN_METHOD_ERRORS,
  accountSignInMethodsSchema,
  socialSignInProviderSchema,
} from "./account-sign-in-methods.js";

describe("account sign-in methods contract", () => {
  it("lives under the issuer's lax account routes", () => {
    expect(ACCOUNT_SIGN_IN_METHODS_PATH).toBe("/lax/account-sign-in-methods");
    expect(ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH).toBe("/lax/account-sign-in-methods/unlink");
  });

  it("names only Google and Apple", () => {
    expect(socialSignInProviderSchema.safeParse("google").success).toBe(true);
    expect(socialSignInProviderSchema.safeParse("apple").success).toBe(true);
    expect(socialSignInProviderSchema.safeParse("credential").success).toBe(false);
  });

  it("strips anything beyond the provider and the link date", () => {
    const parsed = accountSignInMethodsSchema.parse({
      hasPassword: false,
      social: [{ provider: "google", linkedAt: "2026-10-01T09:00:00Z", accountId: "1234" }],
    });
    expect(parsed.social[0]).toEqual({ provider: "google", linkedAt: "2026-10-01T09:00:00Z" });
  });

  it("lists each refusal once", () => {
    expect(new Set(ACCOUNT_SIGN_IN_METHOD_ERRORS).size).toBe(ACCOUNT_SIGN_IN_METHOD_ERRORS.length);
  });
});
