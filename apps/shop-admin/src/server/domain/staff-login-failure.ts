import { isIdentityRejected, isIdentityUnavailable } from "@auction/identity-rp";

export type StaffLoginFailureCode =
  | "invalid_state"
  | "token_exchange_failed"
  | "identity_unavailable"
  | "invalid_id_token"
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

export function classifyStaffLoginFailure(error: unknown): StaffLoginFailureCode {
  if (error instanceof StaffLoginError) return error.code;
  if (isIdentityUnavailable(error)) return "identity_unavailable";
  if (isIdentityRejected(error)) return "token_exchange_failed";
  return "session_unavailable";
}
