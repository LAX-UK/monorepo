import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PASSWORD_CHANGE_PATH,
  ACCOUNT_PASSWORD_ERRORS,
  accountPasswordChangedSchema,
} from "./account-password.js";

describe("account password contract", () => {
  it("lives under the issuer's lax account routes", () => {
    expect(ACCOUNT_PASSWORD_CHANGE_PATH).toBe("/lax/account-password/change");
  });

  it("accepts the issuer's answer and strips anything else it might add", () => {
    expect(
      accountPasswordChangedSchema.parse({ changed: true, created: false, hash: "secret" }),
    ).toEqual({ changed: true, created: false });
  });

  it("rejects an answer that does not say the password changed", () => {
    expect(accountPasswordChangedSchema.safeParse({ changed: false, created: false }).success).toBe(
      false,
    );
  });

  it("names every refusal once", () => {
    expect(new Set(ACCOUNT_PASSWORD_ERRORS).size).toBe(ACCOUNT_PASSWORD_ERRORS.length);
  });
});
