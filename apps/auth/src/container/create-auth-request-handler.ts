import {
  type IdentityEventPublisher,
  type SessionStampStore,
  stampMfaCompletedFromResponse,
  stampSocialAuthFromResponse,
} from "@auction/auth";
import type { createAuth } from "@auction/auth";
import type { BackchannelLogoutRevoker } from "../services/backchannel-logout-revocation.service.js";
import {
  type OidcSessionCoordinator,
  createAuthorizationServerErrorResponse,
  readAuthorizationCodeFromResponse,
} from "../services/oidc-session-coordinator.js";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";
import {
  buildCookieHeaderForAuthorizationCodeCapture,
  readResponseSetCookies,
  withSessionDataClearedOnLogout,
} from "./better-auth-session-cookies.js";

export type AuthRequestHandler = (
  request: Request,
  authorizationCode?: string | null,
) => Promise<Response>;

export type AuthRequestLogger = {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
};

/** Delays before each background retry of a security side effect that failed after the auth change succeeded. */
export const SECURITY_EFFECT_RETRY_DELAYS_MS = [2_000, 10_000, 60_000] as const;

export function createAuthRequestHandler(options: {
  log: AuthRequestLogger;
  events: IdentityEventPublisher;
  sessionStampStore: SessionStampStore;
  readTwoFactorRequirement: TwoFactorRequirementReader;
  auth: ReturnType<typeof createAuth>;
  oidcSessions: Pick<OidcSessionCoordinator, "runTokenRequest" | "captureAuthorizationSession">;
  logout: BackchannelLogoutRevoker;
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
      path.endsWith("/two-factor/disable") || path.endsWith("/two-factor/verify-totp");
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
      if (path.endsWith("/sign-out") || path.endsWith("/oauth2/endsession")) {
        if (priorSessionId) {
          await completeSecuritySideEffects([
            options.events.publish({
              type: "user.session_revoked",
              userId: priorSubjectId,
              sessionId: priorSessionId,
            }),
            options.logout.revokeIdentitySessions([priorSessionId]).then(() => undefined),
          ]);
        }
      } else if (logoutSensitive) {
        const effects: Promise<void>[] = [];
        if (path.endsWith("/revoke-sessions")) {
          effects.push(
            options.events.publish({
              type: "user.session_revoked",
              userId: priorSubjectId,
            }),
          );
        }
        if (path.endsWith("/change-password")) {
          effects.push(
            options.events.publish({
              type: "user.credential_changed",
              userId: priorSubjectId,
              changeType: "update",
            }),
          );
        }
        effects.push(options.logout.revokeSubject(priorSubjectId).then(() => undefined));
        await completeSecuritySideEffects(effects);
      } else if (priorSessionId && changesTwoFactorState(path, priorSession)) {
        // Better Auth has already enabled or disabled 2FA, so a failure here must not become
        // a 500 that hides the backup codes or drops the user's rotated session.
        const effect = { path, userId: priorSubjectId };
        await Promise.all([
          settleSecurityEffect(options.log, { ...effect, effect: "revoke_other_sessions" }, () =>
            revokeOtherIdentitySessions(options.auth, request, response),
          ),
          settleSecurityEffect(
            options.log,
            { ...effect, effect: "publish_credential_changed" },
            () =>
              options.events.publish({
                type: "user.credential_changed",
                userId: priorSubjectId,
                changeType: "update",
              }),
          ),
          settleSecurityEffect(options.log, { ...effect, effect: "revoke_subject_tokens" }, () =>
            options.logout
              .revokeSubjectExceptIdentitySession(priorSubjectId, priorSessionId)
              .then(() => undefined),
          ),
        ]);
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

async function completeSecuritySideEffects(effects: Promise<void>[]): Promise<void> {
  const failures = (await Promise.allSettled(effects))
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Multiple authentication security side effects failed");
  }
}

function describeError(error: unknown): { errorName: string; errorMessage: string } {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "unknown", errorMessage: String(error) };
}

/**
 * Runs a side effect of an already-committed auth change. A failure is logged with
 * its context (never the request or its cookies) and retried in the background with
 * back-off, because the change cannot be rolled back and the user must still get
 * the real success response. The first attempt is awaited so the usual case has
 * finished, and session revocation in particular, before the response returns.
 */
async function settleSecurityEffect(
  log: AuthRequestLogger,
  context: { path: string; effect: string; userId?: string },
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
    return;
  } catch (error) {
    log.error({ ...context, ...describeError(error), attempt: 1 }, "auth_security_effect_failed");
  }
  const retry = (index: number): void => {
    const delay = SECURITY_EFFECT_RETRY_DELAYS_MS[index];
    if (delay === undefined) {
      log.error(context, "auth_security_effect_abandoned");
      return;
    }
    setTimeout(() => {
      run().then(
        () => log.warn({ ...context, attempt: index + 2 }, "auth_security_effect_recovered"),
        (error: unknown) => {
          log.error(
            { ...context, ...describeError(error), attempt: index + 2 },
            "auth_security_effect_failed",
          );
          retry(index + 1);
        },
      );
    }, delay).unref();
  };
  retry(0);
}
