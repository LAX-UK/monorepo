import {
  type IdentityEventPublisher,
  type SessionStampStore,
  stampMfaCompletedFromResponse,
} from "@auction/auth";
import type { createAuth } from "@auction/auth";
import type { BackchannelLogoutRevoker } from "../services/backchannel-logout-revocation.service.js";
import {
  type OidcSessionCoordinator,
  createAuthorizationServerErrorResponse,
  readAuthorizationCodeFromResponse,
} from "../services/oidc-session-coordinator.js";

export type AuthRequestHandler = (
  request: Request,
  authorizationCode?: string | null,
) => Promise<Response>;

export function createAuthRequestHandler(options: {
  events: IdentityEventPublisher;
  sessionStampStore: SessionStampStore;
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
    const priorSession = logoutSensitive
      ? await options.auth.api.getSession({ headers: request.headers })
      : null;
    const response = await options.oidcSessions.runTokenRequest(authorizationCode, () =>
      options.auth.handler(request),
    );
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
      }
    }
    if (
      response.ok &&
      (path.endsWith("/two-factor/verify-totp") || path.endsWith("/two-factor/verify-backup-code"))
    ) {
      await stampMfaCompletedFromResponse(options.sessionStampStore, response);
    }
    if (await readAuthorizationCodeFromResponse(response)) {
      const sessionHeaders = new Headers(request.headers);
      const setCookies =
        typeof response.headers.getSetCookie === "function"
          ? response.headers.getSetCookie()
          : [response.headers.get("set-cookie") ?? ""];
      const responseSessionCookie = setCookies
        .map((cookie) => /((?:__Secure-)?better-auth\.session_token=[^;,]+)/.exec(cookie)?.[1])
        .find(Boolean);
      if (responseSessionCookie) {
        const existingCookie = sessionHeaders.get("cookie");
        sessionHeaders.set(
          "cookie",
          existingCookie ? `${existingCookie}; ${responseSessionCookie}` : responseSessionCookie,
        );
      }
      const codeSession = await options.auth.api.getSession({ headers: sessionHeaders });
      const identitySessionId = codeSession?.session?.id;
      if (!identitySessionId) return createAuthorizationServerErrorResponse(response);
      await options.oidcSessions.captureAuthorizationSession(response, identitySessionId);
    }
    return response;
  };
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
