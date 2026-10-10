import { isIdentityRejected, isIdentityUnavailable } from "@auction/identity-rp";

export type StaffLoginFailureCode =
  | "invalid_state"
  | "token_exchange_failed"
  | "identity_unavailable"
  | "invalid_id_token"
  | "mfa_required"
  | "session_unavailable";

export class StaffLoginError extends Error {
  constructor(
    readonly code: StaffLoginFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "StaffLoginError";
  }
}

export type StaffLoginFailureNext =
  | { kind: "restart_for_step_up" }
  | { kind: "show_error"; reason: StaffLoginFailureCode };

/**
 * Sign-in can return a code before the issuer's authorize-time MFA gate runs, so a
 * Bronze token gets one restart: with a live identity session the gate then sends the
 * user to verify or set up their authenticator on the auth pages.
 */
export function nextStepAfterStaffLoginFailure(
  code: StaffLoginFailureCode,
  alreadyRestartedForStepUp: boolean,
): StaffLoginFailureNext {
  if (code === "mfa_required" && !alreadyRestartedForStepUp) return { kind: "restart_for_step_up" };
  return { kind: "show_error", reason: code };
}

export function classifyStaffLoginFailure(error: unknown): StaffLoginFailureCode {
  if (error instanceof StaffLoginError) return error.code;
  if (isIdentityUnavailable(error)) return "identity_unavailable";
  if (isIdentityRejected(error)) return "token_exchange_failed";
  return "session_unavailable";
}
