import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";

type AuthUser = { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };

type OnEmailVerified =
  | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
  | undefined;

/** Orchestrates the post-verify side effects in a dependency-injected, testable way.
 *
 * Order matters: magic-link verify sets `emailVerified = true` for every user (2FA or
 * not), so the parity event must fire before any 2FA redirect. 2FA users then have their
 * single-factor session revoked and are bounced to the password + TOTP login.
 */
export async function runMagicLinkVerifyAfter(deps: {
  user: AuthUser | null | undefined;
  sessionToken: string | null | undefined;
  loginUrl: string;
  onEmailVerified: OnEmailVerified;
  deleteSession: (token: string) => Promise<void>;
  deleteCookie: () => void;
  /** Must throw (Better Auth redirects are control-flow exceptions). */
  redirect: (url: string) => never;
}): Promise<void> {
  const { user, sessionToken } = deps;
  if (!user || !sessionToken) return;

  if (deps.onEmailVerified) {
    void deps.onEmailVerified({ id: user.id, email: user.email, name: user.name }).catch((err) => {
      console.error("[auth] onEmailVerified after magic-link failed", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  if (!user.twoFactorEnabled) return;

  let revoked = false;
  for (let attempt = 0; attempt < 2 && !revoked; attempt += 1) {
    try {
      await deps.deleteSession(sessionToken);
      revoked = true;
    } catch (err) {
      console.error("[auth] magic-link 2FA session revoke failed", {
        userId: user.id,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  deps.deleteCookie();
  deps.redirect(deps.loginUrl);
}

/** After magic-link verify: publish email-verified parity + block 2FA bypass. */
export function buildMagicLinkVerifyAfterHooks(options: {
  webOrigin?: string | undefined;
  onEmailVerified?: OnEmailVerified;
}) {
  const loginUrl = `${(options.webOrigin ?? "https://lax.bid").replace(/\/$/, "")}/login?twofa_required=1`;

  return {
    matcher: (context: { path?: string }) => context.path === "/magic-link/verify",
    handler: createAuthMiddleware(async (ctx) => {
      const data = ctx.context.newSession;
      await runMagicLinkVerifyAfter({
        user: data?.user as AuthUser | undefined,
        sessionToken: data?.session?.token,
        loginUrl,
        onEmailVerified: options.onEmailVerified,
        deleteSession: (token) => ctx.context.internalAdapter.deleteSession(token),
        deleteCookie: () => deleteSessionCookie(ctx, true),
        redirect: (url) => {
          throw ctx.redirect(url);
        },
      });
    }),
  };
}

export function buildMagicLinkVerifyPlugin(options: {
  webOrigin?: string | undefined;
  onEmailVerified?: OnEmailVerified;
}): BetterAuthPlugin {
  return {
    id: "magic-link-verify-hooks",
    hooks: {
      after: [buildMagicLinkVerifyAfterHooks(options)],
    },
  };
}
