import { ACCOUNT_PASSWORD_ERRORS } from "@auction/identity-contracts/account";
import { describe, expect, it } from "vitest";
import {
  PASSWORD_FIELDS,
  buildPasswordHints,
  isPasswordRejection,
  passwordFormMode,
  passwordRejection,
  validatePasswordForm,
} from "./account-password.vm";

const values = (overrides: Partial<Record<"current" | "next" | "confirm", string>> = {}) => ({
  current: "Current-password-1",
  next: "A-better-passphrase-2",
  confirm: "A-better-passphrase-2",
  ...overrides,
});

describe("passwordFormMode", () => {
  it("adds a first password only when the issuer says there is none", () => {
    expect(passwordFormMode({ hasPassword: false })).toBe("create");
    expect(passwordFormMode({ hasPassword: true })).toBe("change");
  });

  it("asks for the current password when the issuer could not say", () => {
    expect(passwordFormMode({ hasPassword: null })).toBe("change");
  });
});

describe("buildPasswordHints", () => {
  const met = (hints: ReturnType<typeof buildPasswordHints>) =>
    Object.fromEntries(hints.map((hint) => [hint.id, hint.met]));

  it("ticks each rule as the person types", () => {
    expect(met(buildPasswordHints(values({ next: "", confirm: "" }), "change"))).toEqual({
      length: false,
      different: false,
      match: false,
    });
    expect(met(buildPasswordHints(values({ next: "short", confirm: "" }), "change"))).toEqual({
      length: false,
      different: true,
      match: false,
    });
    expect(met(buildPasswordHints(values(), "change"))).toEqual({
      length: true,
      different: true,
      match: true,
    });
  });

  it("does not count the current password as a new one", () => {
    const same = values({ next: "Current-password-1", confirm: "Current-password-1" });
    expect(met(buildPasswordHints(same, "change")).different).toBe(false);
  });

  it("leaves out the current-password rule when adding a first password", () => {
    expect(buildPasswordHints(values({ current: "" }), "create").map((hint) => hint.id)).toEqual([
      "length",
      "match",
    ]);
  });
});

describe("validatePasswordForm", () => {
  it("accepts a good change and a good first password", () => {
    expect(validatePasswordForm(values(), "change")).toEqual({});
    expect(validatePasswordForm(values({ current: "" }), "create")).toEqual({});
  });

  it("asks for what is missing, field by field", () => {
    expect(validatePasswordForm({ current: "", next: "", confirm: "" }, "change")).toEqual({
      current: "Enter your current password.",
      next: "Enter a new password.",
      confirm: "Enter your new password again.",
    });
    expect(
      validatePasswordForm({ current: "", next: "", confirm: "" }, "create"),
    ).not.toHaveProperty("current");
  });

  it("states the length limits", () => {
    expect(validatePasswordForm(values({ next: "short", confirm: "short" }), "change").next).toBe(
      "Use at least 12 characters.",
    );
    const long = "a".repeat(129);
    expect(validatePasswordForm(values({ next: long, confirm: long }), "change").next).toBe(
      "Use no more than 128 characters.",
    );
  });

  it("refuses a new password equal to the current one, and a mismatched confirmation", () => {
    expect(
      validatePasswordForm(
        values({ next: "Current-password-1", confirm: "Current-password-1" }),
        "change",
      ).next,
    ).toBe("Choose a password that's different from your current one.");
    expect(validatePasswordForm(values({ confirm: "Something-else-123" }), "change").confirm).toBe(
      "The two new passwords don't match.",
    );
  });

  it("lists fields in page order", () => {
    expect(PASSWORD_FIELDS).toEqual(["current", "next", "confirm"]);
  });
});

describe("passwordRejection", () => {
  it("has a sentence and a field for every refusal the issuer can send", () => {
    for (const reason of ACCOUNT_PASSWORD_ERRORS) {
      const { field, message } = passwordRejection(reason);
      expect(PASSWORD_FIELDS).toContain(field);
      expect(message).toMatch(/\.$/);
    }
  });

  it("puts a wrong current password on its own field and weak passwords on the new one", () => {
    expect(passwordRejection("invalid_password").field).toBe("current");
    expect(passwordRejection("password_breached").field).toBe("next");
  });

  it("recognises only password refusals", () => {
    expect(isPasswordRejection("same_password")).toBe(true);
    expect(isPasswordRejection("email_taken")).toBe(false);
    expect(isPasswordRejection("toString")).toBe(false);
  });
});
