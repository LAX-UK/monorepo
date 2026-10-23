import {
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROFILE_UPDATE_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  ACCOUNT_SESSIONS_PATH,
  ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH,
  ACCOUNT_SESSIONS_REVOKE_PATH,
  accountProfileSchema,
  accountSessionsRevokedSchema,
  accountSessionsSchema,
} from "@auction/identity-contracts";
import type { z } from "zod";
import type { LaxAccountConfig } from "../config";
import type {
  AccountIdentityGateway,
  IdentityActor,
  IdentityCallResult,
} from "../ports/account-identity-gateway";

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Calls the issuer's account routes as LAX Account, for the person who owns the access token.
 * Tokens travel in the request body, never a URL, and nothing here logs them. Every failure
 * (network, timeout, refusal, unexpected body) is `unavailable`, except the issuer's explicit
 * "sign in again", which callers turn into a fresh sign-in.
 */
export function createIssuerAccountIdentityGateway(
  config: Pick<LaxAccountConfig, "oidcInternalIssuer" | "oidcClientId" | "oidcClientSecret">,
  fetchImpl: typeof fetch = fetch,
): AccountIdentityGateway {
  const base = `${config.oidcInternalIssuer}/api/auth`;
  const basic = Buffer.from(
    `${encodeURIComponent(config.oidcClientId)}:${encodeURIComponent(config.oidcClientSecret)}`,
  ).toString("base64");

  async function post<S extends z.ZodTypeAny>(
    path: string,
    fields: Record<string, string>,
    schema: S,
  ): Promise<IdentityCallResult<z.infer<S>>> {
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(fields),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 403) {
        const body: unknown = await response.json().catch(() => null);
        if ((body as { error?: unknown } | null)?.error === ACCOUNT_REAUTH_REQUIRED) {
          return { status: "reauth_required" };
        }
      }
      if (!response.ok) {
        console.warn("account_identity_unavailable", { path, status: response.status });
        return { status: "unavailable" };
      }
      const parsed = schema.safeParse(await response.json());
      return parsed.success ? { status: "ok", value: parsed.data } : { status: "unavailable" };
    } catch (error) {
      console.warn("account_identity_unavailable", {
        path,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  const fields = (actor: IdentityActor, extra: Record<string, string> = {}) => ({
    token: actor.accessToken,
    sid: actor.sid,
    ...extra,
  });

  return {
    async readName(actor) {
      const result = await post(
        ACCOUNT_PROFILE_PATH,
        { token: actor.accessToken },
        accountProfileSchema,
      );
      return result.status === "ok" ? result.value.name : null;
    },
    async rename(actor, name) {
      const result = await post(
        ACCOUNT_PROFILE_UPDATE_PATH,
        fields(actor, { name }),
        accountProfileSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.name } : result;
    },
    async listSessions(actor) {
      const result = await post(ACCOUNT_SESSIONS_PATH, fields(actor), accountSessionsSchema);
      return result.status === "ok" ? { status: "ok", value: result.value.sessions } : result;
    },
    async revokeSession(actor, sessionId) {
      const result = await post(
        ACCOUNT_SESSIONS_REVOKE_PATH,
        fields(actor, { session_id: sessionId }),
        accountSessionsRevokedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.revoked } : result;
    },
    async revokeOtherSessions(actor) {
      const result = await post(
        ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH,
        fields(actor),
        accountSessionsRevokedSchema,
      );
      return result.status === "ok" ? { status: "ok", value: result.value.revoked } : result;
    },
  };
}
