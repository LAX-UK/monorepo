import {
  type SecurityNoticePublisher,
  type SessionStampStore,
  stampMfaCompletedFromResponse,
  stampSocialAuthFromResponse,
} from "@auction/auth";
import type { createAuth } from "@auction/auth";
import type {
  DurableSecurityEffects,
  SecurityEffectJob,
} from "../services/durable-security-effects.js";
import {
  type OidcSessionCoordinator,
  createAuthorizationServerErrorResponse,
  readAuthorizationCodeFromResponse,
} from "../services/oidc-session-coordinator.js";
import {
  SECURITY_EFFECT_RETRY_DELAYS_MS,
  type SecurityEffectLogger,
  describeError,
  settleSecurityEffect,
} from "../services/settle-security-effect.js";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";
import {
  buildCookieHeaderForAuthorizationCodeCapture,
  readResponseSetCookies,
  withSessionDataClearedOnLogout,
} from "./better-auth-session-cookies.js";

export { SECURITY_EFFECT_RETRY_DELAYS_MS };

export type AuthRequestHandler = (
  request: Request,
  authorizationCode?: string | null,
) => Promise<Response>;

export type AuthRequestLogger = SecurityEffectLogger;

type ChangeNoticeKind =
  | "password_changed"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "backup_codes_regenerated";

export function createAuthRequestHandler(options: {
  log: AuthRequestLogger;
  /** Runs revocations and event publication with durable retries; see `DurableSecurityEffects`. */
  durable: Pick<DurableSecurityEffects, "settle">;
  /** Emails the person about 2FA, backup code and password changes. Never throws. */
  notices: SecurityNoticePublisher;
  sessionStampStore: SessionStampStore;
  readTwoFactorRequirement: TwoFactorRequirementReader;
  auth: ReturnType<typeof createAuth>;
  oidcSessions: Pick<OidcSessionCoordinator, "runTokenRequest" | "captureAuthorizationSession">;
}): AuthRequestHandler {
  return async (request, authorizationCode = null) => {
    const path = new URL(request.url).pathname;
    const logoutSensitive =
      path.endsWith("/sign-out") ||
      path.endsWith("/revoke-session") ||
      path.endsWith("/revoke-sessions") ||
      path.endsWith("/change-password") ||
      path.endsWith("/reset-password") ||
      path.endsWith("/oauth2/endsession");
    const twoFactorSensitive =
      path.endsWith("/two-factor/disable") ||
      path.endsWith("/two-factor/verify-totp") ||
      path.endsWith("/two-factor/generate-backup-codes");
    // Both lookups run before Better Auth changes anything, so failing closed here costs
    // the user a retry and nothing else: without the session we cannot revoke the old
    // sessions afterwards, and without the policy we cannot tell whether 2FA may be turned off.
    let priorSession: Awaited<ReturnType<typeof options.auth.api.getSession>> = null;
    if (logoutSensitive || twoFactorSensitive) {
      try {
        priorSession = await options.auth.api.getSession({ headers: request.headers });
      } catch (error) {
        options.log.error({ ...describeError(error), path }, "auth_prior_session_lookup_failed");
        return temporarilyUnavailableResponse();
      }
    }
    if (path.endsWith("/two-factor/disable") && priorSession?.user?.id) {
      try {
        const requirement = await options.readTwoFactorRequirement(priorSession.user.id);
        if (requirement.required) return twoFactorRequiredByPolicyResponse();
      } catch (error) {
        options.log.error(
          { ...describeError(error), path, userId: priorSession.user.id },
          "auth_two_factor_requirement_lookup_failed",
        );
        return temporarilyUnavailableResponse();
      }
    }
    let response = await options.oidcSessions.runTokenRequest(authorizationCode, () =>
      options.auth.handler(request),
    );
    response = withSessionDataClearedOnLogout(response, path);
    const priorSubjectId = priorSession?.user?.id;
    const priorSessionId = priorSession?.session?.id;
    if (response.ok && priorSubjectId) {
      const userId = priorSubjectId;
      const settle = (job: SecurityEffectJob, attempt?: () => Promise<void>) =>
        options.durable.settle(path, job, attempt);
      // Better Auth has already committed each change below, so a failed side effect must not
      // become a 500 that hides the backup codes or drops the user's rotated session. Each one
      // is retried from the durable outbox instead.
      const notice = (kind: ChangeNoticeKind) => {
        void options.notices.notify({
          kind,
          userId,
          at: new Date(),
          userAgent: request.headers.get("user-agent"),
        });
      };
      if (path.endsWith("/sign-out") || path.endsWith("/oauth2/endsession")) {
        if (priorSessionId) {
          await Promise.all([
            settle({ kind: "publish_session_revoked", userId, sessionId: priorSessionId }),
            settle({ kind: "revoke_identity_sessions", userId, sessionIds: [priorSessionId] }),
          ]);
        }
      } else if (logoutSensitive) {
        const effects: Promise<void>[] = [];
        if (path.endsWith("/revoke-sessions")) {
          effects.push(settle({ kind: "publish_session_revoked", userId }));
        }
        if (path.endsWith("/change-password")) {
          effects.push(settle({ kind: "publish_credential_changed", userId }));
          notice("password_changed");
        }
        effects.push(settle({ kind: "revoke_subject_tokens", userId }));
        await Promise.all(effects);
      } else if (priorSessionId && changesTwoFactorState(path, priorSession)) {
        await Promise.all([
          settle(
            { kind: "end_other_identity_sessions", userId, keepSessionId: priorSessionId },
            () => revokeOtherIdentitySessions(options.auth, request, response),
          ),
          settle({ kind: "publish_credential_changed", userId }),
          settle({ kind: "revoke_tokens_except_session", userId, keepSessionId: priorSessionId }),
        ]);
        notice(path.endsWith("/two-factor/disable") ? "two_factor_disabled" : "two_factor_enabled");
      } else if (path.endsWith("/two-factor/generate-backup-codes")) {
        notice("backup_codes_regenerated");
      }
    }
    if (
      response.ok &&
      (path.endsWith("/two-factor/verify-totp") || path.endsWith("/two-factor/verify-backup-code"))
    ) {
      // Fails safe: an unstamped session reads as password-only, so a relying party that needs
      // MFA asks the user to verify again. Never fail the response, the code was correct.
      await settleSecurityEffect(options.log, { path, effect: "stamp_mfa_completed" }, () =>
        stampMfaCompletedFromResponse(options.sessionStampStore, response),
      );
    }
    if (response.status < 400 && isSocialSignInPath(path)) {
      await settleSecurityEffect(options.log, { path, effect: "stamp_social_auth" }, () =>
        stampSocialAuthFromResponse(options.sessionStampStore, response),
      );
    }
    if (await readAuthorizationCodeFromResponse(response, request.url)) {
      // Fails closed: without a confirmed session the code must not be bound, so the client
      // gets an authorisation-server error instead of a code that no session owns.
      const codeSession = await options.auth.api
        .getSession({
          headers: headersWithResponseSessionCookie(request, response),
          query: { disableCookieCache: true },
        })
        .catch((error: unknown) => {
          options.log.error({ ...describeError(error), path }, "auth_code_session_lookup_failed");
          return null;
        });
      const identitySessionId = codeSession?.session?.id;
      if (!identitySessionId) return createAuthorizationServerErrorResponse(response, request.url);
      await options.oidcSessions.captureAuthorizationSession(response, identitySessionId);
    }
    return response;
  };
}

export const TWO_FACTOR_REQUIRED_BY_POLICY = "TWO_FACTOR_REQUIRED_BY_POLICY";

function temporarilyUnavailableResponse(): Response {
  return Response.json(
    {
      code: "TEMPORARILY_UNAVAILABLE",
      message: "We couldn't complete that just now. Please try again in a moment.",
    },
    { status: 503, headers: { "Retry-After": "5" } },
  );
}

function twoFactorRequiredByPolicyResponse(): Response {
  return Response.json(
    {
      code: TWO_FACTOR_REQUIRED_BY_POLICY,
      message:
        "Two-step verification is required for your LAX staff or organisation access, so it can't be turned off.",
    },
    { status: 403 },
  );
}

/** OAuth callbacks (`/callback/:provider`, `/oauth2/callback/:provider`) and ID-token social sign-in. */
function isSocialSignInPath(path: string): boolean {
  return /\/callback\/[^/]+$/.test(path) || path.endsWith("/sign-in/social");
}

/**
 * Disabling 2FA, or the first TOTP verification that enables it, rotates the
 * current session; sign-in and step-up verifications leave 2FA state alone.
 */
function changesTwoFactorState(
  path: string,
  priorSession: { user?: { twoFactorEnabled?: boolean | null | undefined } | null } | null,
): boolean {
  if (path.endsWith("/two-factor/disable")) return true;
  return path.endsWith("/two-factor/verify-totp") && priorSession?.user?.twoFactorEnabled !== true;
}

function headersWithResponseSessionCookie(request: Request, response: Response): Headers {
  const headers = new Headers(request.headers);
  const responseSessionCookie = readResponseSetCookies(response)
    .map((cookie) => /((?:__Secure-)?better-auth\.session_token=[^;,]+)/.exec(cookie)?.[1])
    .find(Boolean);
  headers.set(
    "cookie",
    buildCookieHeaderForAuthorizationCodeCapture(
      headers.get("cookie"),
      responseSessionCookie ?? null,
    ),
  );
  return headers;
}

async function revokeOtherIdentitySessions(
  auth: ReturnType<typeof createAuth>,
  request: Request,
  response: Response,
): Promise<void> {
  await auth.api.revokeOtherSessions({
    headers: headersWithResponseSessionCookie(request, response),
  });
}
