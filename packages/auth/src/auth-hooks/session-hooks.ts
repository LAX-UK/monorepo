import { APIError } from "better-auth/api";
import { assertUserNotSuspendedForSession } from "../session-suspended-guard.js";
import { SOCIAL_SIGN_IN_ERROR_CODES, mayUseSocialSignIn } from "../social-sign-in-policy.js";
import type { AuthHookDeps } from "./auth-hook-deps.js";
import {
  readSocialSubjectReporting,
  recordStaffRefusal,
  socialFlow,
  socialProviderOfRequest,
} from "./social-flow.js";

/** Session-creating requests that come back from Google or Apple (including an ID-token sign-in). */
export function isSocialSessionPath(path: string | undefined): boolean {
  return path === "/sign-in/social" || (path?.startsWith("/callback/") ?? false);
}

/** Edge headers that carry a country code; a coarse signal, never an address. */
const REGION_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

/** The country code the edge reported for a request, or null; never an address. */
export function readRequestRegion(headers: Headers | undefined): string | null {
  return REGION_HEADERS.map((name) => headers?.get(name)?.trim()).find(Boolean) ?? null;
}

export function buildSessionDatabaseHooks(deps: AuthHookDeps) {
  return {
    create: {
      before: async (sess: { userId: string }, context?: { path?: string | undefined } | null) => {
        await assertUserNotSuspendedForSession(deps.ports.subjectStatusReader, sess.userId);
        // SM14: staff are never signed in by Google or Apple, even through a link made earlier.
        if (!isSocialSessionPath(context?.path) || socialFlow(context).newUser) return;
        // A failed read stops the sign-in on the hosted page with a code it can explain, never a
        // bare server error.
        const subject = await readSocialSubjectReporting(deps, sess.userId).catch(() => {
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: "Sign-in with Google or Apple is unavailable just now.",
            code: SOCIAL_SIGN_IN_ERROR_CODES.unavailable,
          });
        });
        if (!mayUseSocialSignIn(subject)) {
          await recordStaffRefusal(deps, {
            userId: sess.userId,
            provider: socialProviderOfRequest(context),
            attempt: "sign_in",
          });
          throw new APIError("FORBIDDEN", {
            message: "Staff accounts cannot sign in with Google or Apple.",
            code: SOCIAL_SIGN_IN_ERROR_CODES.staffNotAllowed,
          });
        }
      },
      after: async (
        sess: {
          userId: string;
          createdAt: Date;
          userAgent?: string | null | undefined;
        },
        context?: { request?: { headers: Headers } | undefined } | null,
      ) => {
        if (!deps.enableNewDeviceLoginEmail) return;
        const headers = context?.request?.headers;
        void deps.ports.securityNotices?.notify({
          kind: "sign_in",
          userId: sess.userId,
          at: new Date(sess.createdAt),
          userAgent: sess.userAgent ?? headers?.get("user-agent") ?? null,
          region: readRequestRegion(headers),
          deviceHash: deps.readDeviceHash?.(headers) ?? null,
        });
      },
    },
  };
}
