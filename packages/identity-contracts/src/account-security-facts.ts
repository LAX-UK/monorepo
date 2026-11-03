import { z } from "zod";

/** Issuer route LAX Account calls (under the Better Auth base path) to read live security state. */
export const ACCOUNT_SECURITY_FACTS_PATH = "/lax/account-security-facts";

/**
 * What the issuer tells LAX Account about one person's sign-in security. Counts and booleans
 * only: never a secret, a backup code or a credential hash.
 */
export const accountSecurityFactsSchema = z.object({
  twoFactorEnabled: z.boolean(),
  /** Whether the account has a password; false for an account that only signs in with a social or passkey login. */
  hasPassword: z.boolean(),
  /**
   * Unused backup codes. Null when the person has no two-step verification, or when the issuer
   * could not read the codes; callers must treat null as "unknown", not as zero.
   */
  backupCodesRemaining: z.number().int().nonnegative().nullable(),
});

export type AccountSecurityFactsResponse = z.infer<typeof accountSecurityFactsSchema>;
