import { type SessionStampStore, stampMfaCompletedFromResponse } from "@auction/auth";
import type { createAuth } from "@auction/auth";
import {
  type Database,
  publishUserCredentialChanged,
  publishUserSessionRevoked,
} from "@auction/db";
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
  db: Database;
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
          await options.logout.revokeIdentitySessions([priorSessionId]);
          await publishUserSessionRevoked(
            options.db,
            {
              subjectId: priorSubjectId,
              sessionId: priorSessionId,
              revokedAt: new Date().toISOString(),
            },
            { producer: "apps/auth" },
          );
        }
      } else if (logoutSensitive) {
        await options.logout.revokeSubject(priorSubjectId);
        if (path.endsWith("/revoke-sessions")) {
          await publishUserSessionRevoked(
            options.db,
            { subjectId: priorSubjectId, revokedAt: new Date().toISOString() },
            { producer: "apps/auth" },
          );
        }
        if (path.endsWith("/change-password")) {
          await publishUserCredentialChanged(
            options.db,
            {
              subjectId: priorSubjectId,
              credentialType: "password",
              changeType: "update",
              changedAt: new Date().toISOString(),
            },
            { producer: "apps/auth" },
          );
        }
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
