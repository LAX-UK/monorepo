import { z } from "zod";

/** Issuer routes LAX Account calls (under the Better Auth base path) to show and remove sign-in methods. */
export const ACCOUNT_SIGN_IN_METHODS_PATH = "/lax/account-sign-in-methods";
export const ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH = "/lax/account-sign-in-methods/unlink";

/** The social sign-ins a person can have linked. */
export const SOCIAL_SIGN_IN_PROVIDERS = ["google", "apple"] as const;
export const socialSignInProviderSchema = z.enum(SOCIAL_SIGN_IN_PROVIDERS);
export type SocialSignInProvider = z.infer<typeof socialSignInProviderSchema>;

/**
 * How the person can sign in today. No secret and no provider identifier: a linked provider is
 * named and dated, and always uses the address on the account, because the issuer links a
 * provider only when it reports that same address.
 */
export const accountSignInMethodsSchema = z.object({
  hasPassword: z.boolean(),
  social: z.array(
    z.object({
      provider: socialSignInProviderSchema,
      linkedAt: z.string().datetime({ offset: true }),
    }),
  ),
});

export const accountSignInMethodUnlinkedSchema = z.object({
  unlinked: socialSignInProviderSchema,
  /** Other sign-ins ended because the method was removed; the one making the request stays. */
  revokedSessions: z.number().int().nonnegative(),
});

/**
 * Reasons the issuer refuses to remove a method, returned as `{ error }`:
 *  - `last_sign_in_method`: it is the only way left to sign in (422);
 *  - `not_linked`: that provider is not linked to the account (404);
 *  - `rate_limited`: too many attempts (429).
 */
export const ACCOUNT_SIGN_IN_METHOD_ERRORS = [
  "last_sign_in_method",
  "not_linked",
  "rate_limited",
] as const;

export type AccountSignInMethodError = (typeof ACCOUNT_SIGN_IN_METHOD_ERRORS)[number];
export type AccountSignInMethodsResponse = z.infer<typeof accountSignInMethodsSchema>;
export type AccountSignInMethodUnlinkedResponse = z.infer<typeof accountSignInMethodUnlinkedSchema>;
