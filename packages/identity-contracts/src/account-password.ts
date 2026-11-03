import { z } from "zod";

/** Issuer route LAX Account calls (under the Better Auth base path) to change or set the password. */
export const ACCOUNT_PASSWORD_CHANGE_PATH = "/lax/account-password/change";

/** The issuer's rules for a new password; Account repeats them as hints while the person types. */
export const ACCOUNT_PASSWORD_MIN_LENGTH = 12;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128;

/**
 * `created` is true when the account had no password before (it signed in with a social or
 * passkey login) and this call set the first one.
 */
export const accountPasswordChangedSchema = z.object({
  changed: z.literal(true),
  created: z.boolean(),
});

/**
 * Reasons the issuer refuses a password change, returned as `{ error }`:
 *  - `invalid_password`: the current password is wrong (403);
 *  - `invalid_password_policy`: too short, too long or on the common-password list (422);
 *  - `password_breached`: the password appears in known data breaches (422);
 *  - `same_password`: the new password equals the current one (422);
 *  - `rate_limited`: too many attempts (429).
 */
export const ACCOUNT_PASSWORD_ERRORS = [
  "invalid_password",
  "invalid_password_policy",
  "password_breached",
  "same_password",
  "rate_limited",
] as const;

export type AccountPasswordError = (typeof ACCOUNT_PASSWORD_ERRORS)[number];
export type AccountPasswordChangedResponse = z.infer<typeof accountPasswordChangedSchema>;
