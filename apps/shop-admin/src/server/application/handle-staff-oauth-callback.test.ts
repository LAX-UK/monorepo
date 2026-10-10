import { describe, expect, it } from "vitest";
import { resolveStaffOAuthCallback } from "./handle-staff-oauth-callback.js";

const pending = {
  state: "state-abc",
  nonce: "n",
  codeVerifier: "v",
  returnTo: "/",
};

describe("resolveStaffOAuthCallback", () => {
  it("maps OAuth login_required with Silver to mfa_required", () => {
    const outcome = resolveStaffOAuthCallback(
      {
        code: null,
        state: "state-abc",
        oauthError: "login_required",
        errorDescription: "Silver ACR required",
      },
      { pendingRaw: JSON.stringify(pending), hadLoginRetry: false },
    );
    expect(outcome).toMatchObject({ kind: "login_error", reason: "mfa_required" });
  });

  it("returns missing_code when neither code nor error", () => {
    expect(
      resolveStaffOAuthCallback(
        { code: null, state: null, oauthError: null, errorDescription: null },
        { pendingRaw: undefined, hadLoginRetry: false },
      ).kind,
    ).toBe("missing_code");
  });

  it("returns invalid_state on state mismatch for error response", () => {
    expect(
      resolveStaffOAuthCallback(
        {
          code: null,
          state: "wrong",
          oauthError: "access_denied",
          errorDescription: null,
        },
        { pendingRaw: JSON.stringify(pending), hadLoginRetry: false },
      ).kind,
    ).toBe("invalid_state");
  });
});
