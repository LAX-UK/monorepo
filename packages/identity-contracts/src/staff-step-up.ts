/**
 * Staff step-up: dangerous staff actions (money, roles, sign-in protection, impersonation)
 * need a recent sign-in. Both staff tools use the same window and the same error code so the
 * browser can answer one way: send the person through a fresh sign-in, then let them retry.
 */

/** HTTP 403 `code` returned when the caller's sign-in is missing or older than the window. */
export const STAFF_STEP_UP_REQUIRED = "step_up_required";

/** How recent the sign-in must be, in seconds, for a dangerous staff action. */
export const STAFF_STEP_UP_MAX_AGE_SECONDS = 900;

/**
 * True when a sign-in that began at `authTimeSeconds` (epoch seconds) is still within
 * `maxAgeSeconds` of `nowSeconds`. A missing or future time is never recent.
 */
export function isRecentStaffAuthentication(input: {
  authTimeSeconds: number | null | undefined;
  nowSeconds: number;
  maxAgeSeconds?: number;
}): boolean {
  const { authTimeSeconds, nowSeconds, maxAgeSeconds = STAFF_STEP_UP_MAX_AGE_SECONDS } = input;
  if (authTimeSeconds == null || !Number.isFinite(authTimeSeconds)) return false;
  const age = nowSeconds - authTimeSeconds;
  return age >= 0 && age <= maxAgeSeconds;
}
