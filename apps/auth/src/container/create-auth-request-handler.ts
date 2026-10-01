import {
  type IdentityEventPublisher,
  type SessionStampStore,
  stampMfaCompletedFromResponse,
} from "@auction/auth";
import type { createAuth } from "@auction/auth";
import { resolveIdentitySessionForAuthorization } from "../auth-handoff/resolve-identity-session-for-authorization.js";
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

function collectSetCookieHeaders(response: Response): string[] {
  return typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
}

export function createAuthRequestHandler(options: {
  events: IdentityEventPublisher;
  sessionStampStore: SessionStampStore;
  auth: ReturnType<typeof createAuth>;
  oidcSessions: Pick<OidcSessionCoordinator, "runTokenRequest" | "captureAuthorizationSession">;
  logout: BackchannelLogoutRevoker;
  logAuthorizationHandoff?: (payload: Record<string, string | boolean | undefined>) => void;
}): AuthRequestHandler {
  const logHandoff = options.logAuthorizationHandoff;

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
      const setCookies = collectSetCookieHeaders(response);
      const resolved = await resolveIdentitySessionForAuthorization({
        getSession: (headers) => options.auth.api.getSession({ headers }),
        requestHeaders: request.headers,
        setCookieHeaders: setCookies,
      });
      const identitySessionId = resolved.identitySessionId;
      if (!identitySessionId) {
        logHandoff?.({
          event: "auth_authorization_handoff",
          stage: "session_lookup",
          outcome: "error",
          hadIncomingSessionCookie: resolved.hadIncomingSessionCookie,
          hadResponseSessionCookie: resolved.hadResponseSessionCookie,
          strippedStale: resolved.strippedStale,
          sessionSource: resolved.sessionSource,
        });
        return createAuthorizationServerErrorResponse(response);
      }
      await options.oidcSessions.captureAuthorizationSession(response, identitySessionId);
      logHandoff?.({
        event: "auth_authorization_handoff",
        stage: "session_correlation",
        outcome: "ok",
        hadIncomingSessionCookie: resolved.hadIncomingSessionCookie,
        hadResponseSessionCookie: resolved.hadResponseSessionCookie,
        strippedStale: resolved.strippedStale,
        sessionSource: resolved.sessionSource,
      });
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
