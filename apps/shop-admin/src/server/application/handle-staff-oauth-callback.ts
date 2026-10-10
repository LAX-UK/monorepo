import { classifyAuthorizationError, validateOAuthStateTimingSafe } from "@auction/identity-rp";
import type { PendingStaffLogin } from "./start-staff-login";

export type StaffOAuthCallbackQuery = {
  code: string | null;
  state: string | null;
  oauthError: string | null;
  errorDescription: string | null;
};

export type StaffOAuthCallbackPendingContext = {
  pendingRaw: string | undefined;
  hadLoginRetry: boolean;
};

export type StaffOAuthCallbackOutcome =
  | { kind: "login_error"; reason: string; log: { oauthError: string; reason: string } }
  | { kind: "missing_code" }
  | { kind: "retry_login" }
  | { kind: "missing_pending" }
  | { kind: "invalid_state" }
  | {
      kind: "exchange";
      pending: PendingStaffLogin;
      code: string;
      receivedState: string;
    };

export function resolveStaffOAuthCallback(
  query: StaffOAuthCallbackQuery,
  pendingCtx: StaffOAuthCallbackPendingContext,
): StaffOAuthCallbackOutcome {
  const oauthError = query.oauthError?.trim() ?? null;
  const errorDescription = query.errorDescription?.trim() ?? null;
  const state = query.state?.trim() ?? null;
  const code = query.code?.trim() ?? null;

  if (oauthError) {
    const mapped =
      classifyAuthorizationError({ error: oauthError, errorDescription }) ?? "auth_failed";
    if (pendingCtx.pendingRaw && state) {
      try {
        const pending = JSON.parse(pendingCtx.pendingRaw) as PendingStaffLogin;
        if (!validateOAuthStateTimingSafe(pending.state, state)) {
          return { kind: "invalid_state" };
        }
      } catch {
        return { kind: "invalid_state" };
      }
    }
    return {
      kind: "login_error",
      reason: mapped,
      log: { oauthError, reason: mapped },
    };
  }

  if (!code || !state) {
    return { kind: "missing_code" };
  }

  if (!pendingCtx.pendingRaw) {
    if (!pendingCtx.hadLoginRetry) {
      return { kind: "retry_login" };
    }
    return { kind: "missing_pending" };
  }

  let pending: PendingStaffLogin;
  try {
    pending = JSON.parse(pendingCtx.pendingRaw) as PendingStaffLogin;
  } catch {
    return {
      kind: "login_error",
      reason: "auth_failed",
      log: { oauthError: "invalid_pending", reason: "auth_failed" },
    };
  }

  if (!validateOAuthStateTimingSafe(pending.state, state)) {
    return { kind: "invalid_state" };
  }

  return { kind: "exchange", pending, code, receivedState: state };
}
