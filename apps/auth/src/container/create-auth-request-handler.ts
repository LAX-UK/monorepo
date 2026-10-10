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

export function createAuthRequestHandler(options: {
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
    const priorSession =
      logoutSensitive || twoFactorSensitive
        ? await options.auth.api.getSession({ headers: request.headers })
        : null;
    if (path.endsWith("/two-factor/disable") && priorSession?.user?.id) {
      const requirement = await options.readTwoFactorRequirement(priorSession.user.id);
      if (requirement.required) return twoFactorRequiredByPolicyResponse();
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
        await completeSecuritySideEffects([
          revokeOtherIdentitySessions(options.auth, request, response),
          options.events.publish({
            type: "user.credential_changed",
            userId: priorSubjectId,
            changeType: "update",
          }),
          options.logout
            .revokeSubjectExceptIdentitySession(priorSubjectId, priorSessionId)
            .then(() => undefined),
        ]);
      }
    }
    if (
      response.ok &&
      (path.endsWith("/two-factor/verify-totp") || path.endsWith("/two-factor/verify-backup-code"))
    ) {
      await stampMfaCompletedFromResponse(options.sessionStampStore, response);
    }
    if (response.status < 400 && isSocialSignInPath(path)) {
      await stampSocialAuthFromResponse(options.sessionStampStore, response);
    }
    if (await readAuthorizationCodeFromResponse(response, request.url)) {
      const codeSession = await options.auth.api.getSession({
        headers: headersWithResponseSessionCookie(request, response),
        query: { disableCookieCache: true },
      });
      const identitySessionId = codeSession?.session?.id;
      if (!identitySessionId) return createAuthorizationServerErrorResponse(response, request.url);
      await options.oidcSessions.captureAuthorizationSession(response, identitySessionId);
    }
    return response;
  };
}

export const TWO_FACTOR_REQUIRED_BY_POLICY = "TWO_FACTOR_REQUIRED_BY_POLICY";

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
