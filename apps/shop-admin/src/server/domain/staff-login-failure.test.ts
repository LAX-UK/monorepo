import { IdentityRejectedError, IdentityUnavailableError } from "@auction/identity-rp";
import { describe, expect, it } from "vitest";
import { assertSilverAcr } from "./acr-policy";
import {
  StaffLoginError,
  classifyStaffLoginFailure,
  nextStepAfterStaffLoginFailure,
} from "./staff-login-failure";

function thrownBy(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe("classifyStaffLoginFailure", () => {
  it("names each failure instead of a generic auth_failed", () => {
    expect(classifyStaffLoginFailure(thrownBy(() => assertSilverAcr("bronze")))).toBe(
      "mfa_required",
    );
    expect(classifyStaffLoginFailure(new StaffLoginError("invalid_id_token", "x"))).toBe(
      "invalid_id_token",
    );
    expect(classifyStaffLoginFailure(new IdentityUnavailableError("down"))).toBe(
      "identity_unavailable",
    );
    expect(
      classifyStaffLoginFailure(new IdentityRejectedError(400, "rejected", "invalid_grant")),
    ).toBe("token_exchange_failed");
    expect(classifyStaffLoginFailure(new Error("redis down"))).toBe("session_unavailable");
  });
});

describe("nextStepAfterStaffLoginFailure", () => {
  it("restarts sign-in once for a non-Silver token so the issuer can step up", () => {
    expect(nextStepAfterStaffLoginFailure("mfa_required", false)).toEqual({
      kind: "restart_for_step_up",
    });
  });

  it("shows the error after the step-up restart, and for every other failure", () => {
    expect(nextStepAfterStaffLoginFailure("mfa_required", true)).toEqual({
      kind: "show_error",
      reason: "mfa_required",
    });
    expect(nextStepAfterStaffLoginFailure("identity_unavailable", false)).toEqual({
      kind: "show_error",
      reason: "identity_unavailable",
    });
  });
});
