import { z } from "zod";

/** Issuer routes LAX Account calls (under the Better Auth base path) to manage sign-ins. */
export const ACCOUNT_SESSIONS_PATH = "/lax/account-sessions";
export const ACCOUNT_SESSIONS_REVOKE_PATH = "/lax/account-sessions/revoke";
export const ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH = "/lax/account-sessions/revoke-others";

/**
 * Returned (HTTP 403) by changes that need a recent sign-in when the caller's sign-in is older
 * than the window below. LAX Account answers by sending the person through a fresh sign-in.
 */
export const ACCOUNT_REAUTH_REQUIRED = "reauth_required";

/** How recent the sign-in must be, in seconds, to rename a person or sign out other devices. */
export const ACCOUNT_STEP_UP_MAX_AGE_SECONDS = 300;

export const accountSessionSchema = z.object({
  id: z.string(),
  /** Raw browser user agent; LAX Account turns it into a device label. Never an IP address. */
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  lastActiveAt: z.string().datetime({ offset: true }),
  /** True for the sign-in that made this request, so it is never offered for sign-out. */
  isCurrent: z.boolean(),
});

export const accountSessionsSchema = z.object({ sessions: z.array(accountSessionSchema) });

export const accountSessionsRevokedSchema = z.object({ revoked: z.number().int().nonnegative() });

export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountSessionsResponse = z.infer<typeof accountSessionsSchema>;
export type AccountSessionsRevokedResponse = z.infer<typeof accountSessionsRevokedSchema>;
