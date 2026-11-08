import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import type { AuthHookDeps } from "./auth-hooks/auth-hook-deps.js";
import { socialFlow } from "./auth-hooks/social-flow.js";
import { SOCIAL_SIGN_IN_ERROR_CODES, isSocialProviderId } from "./social-sign-in-policy.js";

/** `/callback/:id` is the only request that brings a person back from Google or Apple. */
export function isSocialCallbackPath(path: string | undefined): boolean {
  return path?.startsWith("/callback/") ?? false;
}

/** The page the refusal returns to: the sign-in page that started the round trip. */
export function refusalUrl(input: {
  errorUrl: string | undefined;
  callbackUrl: string | undefined;
  baseUrl: string;
  code: string;
}): string {
  const target = new URL(
    input.errorUrl ?? input.callbackUrl ?? `${input.baseUrl}/error`,
    input.baseUrl,
  );
  target.searchParams.set("error", input.code);
  target.searchParams.delete("error_description");
  return target.toString();
}

/**
 * Finishes what the Google and Apple database rules decided during the callback: sends a refused
 * link back to the sign-in page with a code the page can explain, and tells a person whose
 * unconfirmed password was removed. Registered before the two-step enforcement hook, so a
 * refusal never reaches it.
 */
export function buildSocialSignInPolicyPlugin(deps: AuthHookDeps): BetterAuthPlugin {
  return {
    id: "social-sign-in-policy",
    hooks: {
      after: [
        {
          matcher: (context: { path?: string }) => isSocialCallbackPath(context.path),
          handler: createAuthMiddleware(async (ctx) => {
            const flow = socialFlow(ctx);
            if (flow.blockedLink) {
              const state = await getOAuthState().catch(() => null);
              throw ctx.redirect(
                refusalUrl({
                  errorUrl: state?.errorURL,
                  callbackUrl: state?.callbackURL,
                  baseUrl: ctx.context.baseURL,
                  code:
                    flow.blockedLink === "staff"
                      ? SOCIAL_SIGN_IN_ERROR_CODES.staffNotAllowed
                      : SOCIAL_SIGN_IN_ERROR_CODES.accountNotLinked,
                }),
              );
            }
            const userId = flow.secureUserId;
            const session = ctx.context.newSession;
            const provider = ctx.params?.id;
            if (userId && session && typeof provider === "string" && isSocialProviderId(provider)) {
              await deps.ports.events
                ?.publish({ type: "user.unconfirmed_password_removed", userId, provider })
                .catch(() => undefined);
              await deps.ports.securityNotices?.notify({
                kind: "unconfirmed_password_removed",
                userId,
                at: new Date(),
                provider,
                userAgent: ctx.headers?.get("user-agent") ?? null,
              });
            }
          }),
        },
      ],
    },
  };
}
