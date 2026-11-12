import type { AuthAppEnv } from "../env.js";

/**
 * Whether the "new sign-in" email runs. It runs in production and on the test site, so it can be
 * checked there (the email service only delivers test-site mail to seeded and owner addresses).
 * Local development and unit tests leave it off.
 */
export function isNewDeviceEmailEnabled(env: Pick<AuthAppEnv, "NODE_ENV" | "APP_ENV">): boolean {
  return env.NODE_ENV === "production" || env.APP_ENV === "test";
}
