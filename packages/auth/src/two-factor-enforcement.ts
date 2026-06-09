import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";

type AuthUser = { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };

/**
 * Paths where a new session must NOT be challenged for app TOTP:
 * - Credential sign-ins: Better Auth's two-factor plugin already gates these natively
 *   (returns `twoFactorRedirect` instead of a session).
 * - `/two-factor/*`: the session created here IS the post-TOTP session.
 * - OAuth/social (`/sign-in/social`, `/callback/*`, `/oauth2/*`): policy decision — the
 *   identity provider is treated as a sufficient factor, and enforcing TOTP here would
 *   dead-end social-only 2FA users who have no password to complete the challenge with.
 */
const EXEMPT_PATH_PREFIXES = [
  "/sign-in/email",
  "/sign-in/username",
  "/sign-in/phone-number",
  "/sign-in/social",
  "/two-factor",
  "/callback",
  "/oauth2",
] as const;

export function isTwoFactorExemptPath(path: string): boolean {
  return EXEMPT_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Revokes a freshly created single-factor session for a 2FA user and bounces them to
 * the password + TOTP login. Extracted from the magic-link verify hook so every
 * passwordless sign-in surface shares one tested enforcement path.
 */
export async function enforceTwoFactorOnNewSession(deps: {
  user: AuthUser | null | undefined;
  sessionToken: string | null | undefined;
  loginUrl: string;
  deleteSession: (token: string) => Promise<void>;
  deleteCookie: () => void;
  /** Must throw (Better Auth redirects are control-flow exceptions). */
  redirect: (url: string) => never;
}): Promise<void> {
  const { user, sessionToken } = deps;
  if (!user || !sessionToken) return;
  if (!user.twoFactorEnabled) return;

  let revoked = false;
  for (let attempt = 0; attempt < 2 && !revoked; attempt += 1) {
    try {
      await deps.deleteSession(sessionToken);
      revoked = true;
    } catch (err) {
      console.error("[auth] 2FA enforcement session revoke failed", {
        userId: user.id,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  deps.deleteCookie();
  deps.redirect(deps.loginUrl);
}

export function buildTwoFactorEnforcementAfterHook(options: { webOrigin?: string | undefined }) {
  const loginUrl = `${(options.webOrigin ?? "https://lax.bid").replace(/\/$/, "")}/login?twofa_required=1`;

  return {
    matcher: (context: { path?: string }) => !isTwoFactorExemptPath(context.path ?? ""),
    handler: createAuthMiddleware(async (ctx) => {
      const data = ctx.context.newSession;
      if (!data) return;
      await enforceTwoFactorOnNewSession({
        user: data.user as AuthUser | undefined,
        sessionToken: data.session?.token,
        loginUrl,
        deleteSession: (token) => ctx.context.internalAdapter.deleteSession(token),
        deleteCookie: () => deleteSessionCookie(ctx, true),
        redirect: (url) => {
          throw ctx.redirect(url);
        },
      });
    }),
  };
}

/** Cross-cutting guard: any endpoint that creates a session (magic-link verify,
 * email-verification auto-sign-in, future sign-in methods) challenges 2FA users,
 * except the exempt paths above.
 */
export function buildTwoFactorEnforcementPlugin(options: {
  webOrigin?: string | undefined;
}): BetterAuthPlugin {
  return {
    id: "two-factor-enforcement",
    hooks: {
      after: [buildTwoFactorEnforcementAfterHook(options)],
    },
  };
}
