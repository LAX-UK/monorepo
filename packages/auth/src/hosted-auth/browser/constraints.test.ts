import { describe, expect, it } from "vitest";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import {
  emailConstraintMessage,
  messageForValidityState,
  newPasswordConstraintMessage,
  otpConstraintMessage,
  parseFieldKind,
  requiredPasswordMessage,
} from "./constraints.js";

describe("hosted auth display constraints", () => {
  it("matches issuer email rules", () => {
    expect(emailConstraintMessage("")).toBe("Enter your email address.");
    expect(emailConstraintMessage("not-an-email")).toBe("Enter a valid email address.");
    expect(emailConstraintMessage("buyer@example.com")).toBeNull();
  });

  it("requires a password on sign-in without a minimum length", () => {
    expect(requiredPasswordMessage("")).toBe("Password is required.");
    expect(requiredPasswordMessage("short")).toBeNull();
  });

  it("enforces the issuer password length on registration and reset", () => {
    expect(newPasswordConstraintMessage("short")).toBe(
      `Password must be at least ${HOSTED_AUTH_POLICY.passwordMinLength} characters.`,
    );
    expect(
      newPasswordConstraintMessage("a".repeat(HOSTED_AUTH_POLICY.passwordMinLength)),
    ).toBeNull();
    expect(newPasswordConstraintMessage("a".repeat(HOSTED_AUTH_POLICY.passwordMaxLength + 1))).toBe(
      `Password must be at most ${HOSTED_AUTH_POLICY.passwordMaxLength} characters.`,
    );
  });

  it("requires a 6-digit OTP", () => {
    expect(otpConstraintMessage("")).toBe("Enter the verification code.");
    expect(otpConstraintMessage("12ab56")).toBe("Enter the 6-digit code.");
    expect(otpConstraintMessage("123456")).toBeNull();
  });

  it("maps validity flags from data-field-kind, not element ids", () => {
    expect(parseFieldKind("otp")).toBe("otp");
    expect(parseFieldKind("onclick")).toBe("text");
    const empty = {
      valueMissing: true,
      typeMismatch: false,
      patternMismatch: false,
      tooShort: false,
      tooLong: false,
    };
    expect(
      messageForValidityState("email", empty, {
        minLength: 0,
        maxLength: 0,
        validationMessage: "",
      }),
    ).toBe("Enter your email address.");
    expect(
      messageForValidityState("otp", empty, { minLength: 6, maxLength: 6, validationMessage: "" }),
    ).toBe("Enter the verification code.");
    expect(
      messageForValidityState(
        "new-password",
        { ...empty, valueMissing: false, tooShort: true },
        { minLength: 12, maxLength: 128, validationMessage: "" },
      ),
    ).toBe("Password must be at least 12 characters.");
  });
});
