import { z } from "zod";

/** Issuer routes LAX Account calls (under the Better Auth base path) to show and remove sign-in methods. */
export const ACCOUNT_SIGN_IN_METHODS_PATH = "/lax/account-sign-in-methods";
export const ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH = "/lax/account-sign-in-methods/unlink";
/** Asks the issuer for a one-time link to the page that adds a provider or a passkey. */
export const ACCOUNT_SIGN_IN_METHODS_INTENT_PATH = "/lax/account-sign-in-methods/intent";
export const ACCOUNT_SIGN_IN_METHODS_PASSKEY_RENAME_PATH =
  "/lax/account-sign-in-methods/passkeys/rename";
export const ACCOUNT_SIGN_IN_METHODS_PASSKEY_REMOVE_PATH =
  "/lax/account-sign-in-methods/passkeys/remove";

/**
 * The issuer's own pages for adding a method. Account sends the browser to
 * `ACCOUNT_ACTION_PATH?ticket=…`; the issuer runs the provider round trip there and comes back
 * through `ACCOUNT_ACTION_DONE_PATH`, which returns only to LAX Account's Security page.
 */
export const ACCOUNT_ACTION_PATH = "/account-action";
export const ACCOUNT_ACTION_DONE_PATH = "/account-action/done";
/** The issuer's own page for making a passkey, where `/account-action` sends a spent passkey ticket. */
export const ACCOUNT_ACTION_PASSKEY_PATH = "/account-action/passkey";
/** How long a one-time ticket lives. It is spent the first time it is used. */
export const ACCOUNT_ACTION_TICKET_TTL_SECONDS = 120;
/** The query parameter LAX Account's Security page reads the outcome from: a fixed word, never text. */
export const ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM = "signInMethod";

/** The social sign-ins a person can have linked. */
export const SOCIAL_SIGN_IN_PROVIDERS = ["google", "apple"] as const;
export const socialSignInProviderSchema = z.enum(SOCIAL_SIGN_IN_PROVIDERS);
export type SocialSignInProvider = z.infer<typeof socialSignInProviderSchema>;

/** Every kind of sign-in method a person can add or remove, as security emails and events name it. */
export const SIGN_IN_METHOD_KINDS = ["google", "apple", "passkey"] as const;
export const signInMethodKindSchema = z.enum(SIGN_IN_METHOD_KINDS);
export type SignInMethodKind = z.infer<typeof signInMethodKindSchema>;

/**
 * How a session was signed in, recorded when it starts: with the password, through Google or
 * Apple, with a passkey, or by the person linking a method from this session.
 */
export const SESSION_SIGN_IN_METHODS = ["password", "provider", "passkey", "link"] as const;
export const sessionSignInMethodSchema = z.enum(SESSION_SIGN_IN_METHODS);
export type SessionSignInMethod = z.infer<typeof sessionSignInMethodSchema>;

/** What LAX Account asks the issuer to start: the same hand-off serves every way to add a method. */
export const accountActionIntentSchema = z.object({
  /** Where to send the browser: the issuer's `/account-action` page with the one-time ticket. */
  url: z.string().url(),
});
export type AccountActionIntentResponse = z.infer<typeof accountActionIntentSchema>;

/** The most passkeys one person can hold; the database enforces it too. */
export const PASSKEY_LIMIT = 10;
/** The longest name stored for a passkey. */
export const PASSKEY_NAME_MAX_LENGTH = 60;
/** The longest name a person can give one: short enough to read in a list. */
export const PASSKEY_NAME_INPUT_MAX_LENGTH = 40;

/** A passkey as the person sees it: named and dated. The key material never leaves the issuer. */
export const accountPasskeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(PASSKEY_NAME_MAX_LENGTH),
  /** Copied to the person's other devices by their password manager (Apple, Google). */
  synced: z.boolean(),
  /** Built into the device, or a separate security key. */
  kind: z.enum(["platform", "security_key"]),
  createdAt: z.string().datetime({ offset: true }),
  lastUsedAt: z.string().datetime({ offset: true }).nullable(),
});

/**
 * How the person can sign in today. No secret and no provider identifier: a linked provider is
 * named and dated, with the address it reported (null when none was recorded), and a passkey is
 * named and dated.
 *
 * The fields added in version 2 default when an older issuer leaves them out, so LAX Account can
 * be deployed before or after the issuer.
 */
export const accountSignInMethodsSchema = z.object({
  hasPassword: z.boolean(),
  social: z.array(
    z.object({
      provider: socialSignInProviderSchema,
      linkedAt: z.string().datetime({ offset: true }),
      /** The address the provider reported; null when it did not report one or none was kept. */
      providerEmail: z.string().min(1).nullable().default(null),
      /** The provider gave a private relay address instead of the person's own. */
      hidden: z.boolean().default(false),
    }),
  ),
  passkeys: z.array(accountPasskeySchema).default([]),
  /**
   * What this environment offers, so a row for a method that cannot be added is never shown.
   * Nothing is offered unless the issuer says so, including when an older issuer says nothing.
   */
  available: z
    .object({ google: z.boolean(), apple: z.boolean(), passkey: z.boolean() })
    .default({ google: false, apple: false, passkey: false }),
});

/** Renaming a passkey answers with the passkey as the person now sees it. */
export const accountPasskeyRenamedSchema = z.object({ passkey: accountPasskeySchema });

/** Removing a passkey: other sign-ins ended because it was removed; the one making the request stays. */
export const accountPasskeyRemovedSchema = z.object({
  removed: z.literal(true),
  revokedSessions: z.number().int().nonnegative(),
});

export const accountSignInMethodUnlinkedSchema = z.object({
  unlinked: socialSignInProviderSchema,
  /** Other sign-ins ended because the method was removed; the one making the request stays. */
  revokedSessions: z.number().int().nonnegative(),
});

/**
 * Reasons the issuer refuses a sign-in method change, returned as `{ error }`:
 *  - `last_sign_in_method`: it is the only way left to sign in (422);
 *  - `not_linked`: that provider is not linked to the account (404);
 *  - `rate_limited`: too many attempts (429);
 *  - `passkey_limit`: the person already holds the most passkeys allowed (422);
 *  - `not_available`: that method is not offered in this environment (404);
 *  - `staff_not_allowed`: staff accounts cannot sign in with Google or Apple (403);
 *  - `already_linked`: that provider is already linked to this account (409).
 */
export const ACCOUNT_SIGN_IN_METHOD_ERRORS = [
  "last_sign_in_method",
  "not_linked",
  "rate_limited",
  "passkey_limit",
  "not_available",
  "staff_not_allowed",
  "already_linked",
] as const;

/**
 * What the issuer sends back to LAX Account after adding a method (a success) or failing to
 * (an error). Fixed words only, so the page can show its own sentence for each and never a
 * message from a provider.
 */
export const ACCOUNT_SIGN_IN_METHOD_RETURN_CODES = [
  "google_linked",
  "apple_linked",
  "passkey_added",
] as const;
export const ACCOUNT_SIGN_IN_METHOD_RETURN_ERRORS = [
  "cancelled",
  "already_linked_elsewhere",
  "provider_unavailable",
  "expired",
  "reauth_required",
  "rate_limited",
  "passkey_limit",
  "staff_not_allowed",
] as const;

/** Everything the Security page may be sent back with, in one list: a success or an error word. */
export const ACCOUNT_SIGN_IN_METHOD_RETURNS = [
  ...ACCOUNT_SIGN_IN_METHOD_RETURN_CODES,
  ...ACCOUNT_SIGN_IN_METHOD_RETURN_ERRORS,
] as const;
export type AccountSignInMethodReturn = (typeof ACCOUNT_SIGN_IN_METHOD_RETURNS)[number];

export type AccountSignInMethodError = (typeof ACCOUNT_SIGN_IN_METHOD_ERRORS)[number];
export type AccountSignInMethodReturnCode = (typeof ACCOUNT_SIGN_IN_METHOD_RETURN_CODES)[number];
export type AccountSignInMethodReturnError = (typeof ACCOUNT_SIGN_IN_METHOD_RETURN_ERRORS)[number];
export type AccountPasskey = z.infer<typeof accountPasskeySchema>;
export type AccountPasskeyRenamedResponse = z.infer<typeof accountPasskeyRenamedSchema>;
export type AccountPasskeyRemovedResponse = z.infer<typeof accountPasskeyRemovedSchema>;
export type AccountSignInMethodsResponse = z.infer<typeof accountSignInMethodsSchema>;
export type AccountSignInMethodUnlinkedResponse = z.infer<typeof accountSignInMethodUnlinkedSchema>;
