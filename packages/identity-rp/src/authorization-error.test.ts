import { describe, expect, it } from "vitest";
import { classifyAuthorizationError } from "./authorization-error.js";

describe("classifyAuthorizationError", () => {
  it("returns null when error is absent", () => {
    expect(classifyAuthorizationError({ error: null, errorDescription: null })).toBeNull();
  });

  it("maps access_denied", () => {
    expect(
      classifyAuthorizationError({ error: "access_denied", errorDescription: "User denied" }),
    ).toBe("access_denied");
  });

  it("maps unmet_authentication_requirements to mfa_required", () => {
    expect(
      classifyAuthorizationError({
        error: "unmet_authentication_requirements",
        errorDescription: "MFA required",
      }),
    ).toBe("mfa_required");
  });

  it("maps login_required with Silver ACR description to mfa_required", () => {
    expect(
      classifyAuthorizationError({
        error: "login_required",
        errorDescription: "Silver ACR required",
      }),
    ).toBe("mfa_required");
  });

  it("maps generic login_required", () => {
    expect(
      classifyAuthorizationError({
        error: "login_required",
        errorDescription: "Authentication required",
      }),
    ).toBe("login_required");
  });

  it("maps unknown errors to auth_failed", () => {
    expect(classifyAuthorizationError({ error: "server_error", errorDescription: "oops" })).toBe(
      "auth_failed",
    );
  });
});
