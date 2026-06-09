import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

type AuthUser = { id: string; email: string; name: string };

type OnEmailVerified =
  | ((authUser: { id: string; email: string; name: string }) => Promise<void>)
  | undefined;

/** Fires the email-verified parity event after a magic-link verify.
 *
 * Magic-link verify sets `emailVerified = true` for every user, so downstream systems
 * must be told regardless of 2FA status. 2FA enforcement for the freshly created
 * session lives in the cross-cutting guard (`two-factor-enforcement.ts`), which also
 * matches `/magic-link/verify`.
 */
export async function runMagicLinkVerifyAfter(deps: {
  user: AuthUser | null | undefined;
  sessionToken: string | null | undefined;
  onEmailVerified: OnEmailVerified;
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
}

/** After magic-link verify: publish email-verified parity. */
export function buildMagicLinkVerifyAfterHooks(options: {
  onEmailVerified?: OnEmailVerified;
}) {
  return {
    matcher: (context: { path?: string }) => context.path === "/magic-link/verify",
    handler: createAuthMiddleware(async (ctx) => {
      const data = ctx.context.newSession;
      await runMagicLinkVerifyAfter({
        user: data?.user as AuthUser | undefined,
        sessionToken: data?.session?.token,
        onEmailVerified: options.onEmailVerified,
      });
    }),
  };
}

export function buildMagicLinkVerifyPlugin(options: {
  onEmailVerified?: OnEmailVerified;
}): BetterAuthPlugin {
  return {
    id: "magic-link-verify-hooks",
    hooks: {
      after: [buildMagicLinkVerifyAfterHooks(options)],
    },
  };
}
