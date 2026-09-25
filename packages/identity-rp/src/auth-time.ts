import { IdentityRejectedError } from "./errors.js";

export type AssertRecentAuthenticationInput = {
  /** OIDC `auth_time` claim (seconds since epoch). */
  authTime: number | undefined;
  /** Maximum age in seconds since authentication (OAuth `max_age`). */
  maxAgeSeconds: number;
  /** Clock for tests. Defaults to `Date.now()`. */
  nowMs?: number;
};

/**
 * Ensures the user authenticated within `maxAgeSeconds` (step-up / re-auth flows).
 */
export function assertRecentAuthentication(input: AssertRecentAuthenticationInput): void {
  const { authTime, maxAgeSeconds } = input;
  if (authTime == null || !Number.isFinite(authTime) || authTime <= 0) {
    throw new IdentityRejectedError(
      401,
      "Authentication time is missing from the identity token",
      "login_required",
    );
  }
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const age = nowSec - authTime;
  if (age < 0 || age > maxAgeSeconds) {
    throw new IdentityRejectedError(
      401,
      "Recent authentication is required to continue",
      "login_required",
    );
  }
}
