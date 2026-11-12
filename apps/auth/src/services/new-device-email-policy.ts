import type { AuthAppEnv } from "../env.js";

/**
 * Whether the "new sign-in" email runs.
 *
 * `NEW_DEVICE_EMAIL_ENABLED` decides when it is set. Otherwise the email runs in production
 * builds (every deployed image sets NODE_ENV=production) except on the test site (APP_ENV=test).
 * Nothing in this repository limits whom test-site mail reaches: the worker hands every queued
 * email to Postmark with the real recipient, held back only by the suppression list. So the test
 * site stays quiet unless someone turns the email on there deliberately. Local development and
 * unit tests leave it off.
 */
export function isNewDeviceEmailEnabled(
  env: Pick<AuthAppEnv, "NODE_ENV" | "APP_ENV" | "NEW_DEVICE_EMAIL_ENABLED">,
): boolean {
  if (env.NEW_DEVICE_EMAIL_ENABLED !== undefined) return env.NEW_DEVICE_EMAIL_ENABLED;
  return env.NODE_ENV === "production" && env.APP_ENV !== "test";
}
