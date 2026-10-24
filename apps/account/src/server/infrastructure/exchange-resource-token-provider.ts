import { LAX_RESOURCES, type LaxResourceId } from "@auction/identity-contracts";
import type { TokenEndpoint } from "@auction/identity-rp";
import type { AccountProductScope, ResourceTokenProvider } from "../ports/portfolio-gateway";
import type { SessionStore } from "../ports/session-store";

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/** The default scope Account asks products for: it opens their portfolio routes and nothing else. */
export const PORTFOLIO_READ_SCOPE = "lax.portfolio.read";

/**
 * Where a token is cached in the session. Portfolio tokens keep the bare resource id they were
 * always stored under, so sessions saved before other scopes existed keep their cached token.
 */
function cacheKey(resource: LaxResourceId, scope: AccountProductScope) {
  return scope === PORTFOLIO_READ_SCOPE ? resource : (`${resource} ${scope}` as const);
}

/** A token this close to expiry could lapse before the product has read it. */
const EXPIRY_SKEW_MS = 30_000;
const DEFAULT_TOKEN_TTL_SECONDS = 300;

/**
 * Exchanges the signed-in session for one audience-bound token per product API, because the
 * issuer mints a token for exactly one resource per exchange. A token is cached in the
 * session until it nears expiry, so a page that reads two products costs one exchange each,
 * not one per request.
 */
export function createExchangeResourceTokenProvider(deps: {
  tokenEndpoint: TokenEndpoint;
  sessions: SessionStore;
  sessionTtlSeconds: number;
  nowMs?: () => number;
}): ResourceTokenProvider {
  const now = deps.nowMs ?? Date.now;

  async function cacheToken(
    sessionId: string,
    key: ReturnType<typeof cacheKey>,
    cached: { token: string; expiresAtMs: number },
  ): Promise<void> {
    try {
      // Re-read under the refresh lock and change only this entry: the session may have been
      // refreshed meanwhile, and saving the stale copy would overwrite its newer refresh token.
      await deps.sessions.withRefreshLock(sessionId, async () => {
        const current = await deps.sessions.get(sessionId);
        if (!current) return;
        await deps.sessions.save(
          sessionId,
          { ...current, resourceTokens: { ...current.resourceTokens, [key]: cached } },
          deps.sessionTtlSeconds,
        );
      });
    } catch (error) {
      // Not caching only costs another exchange next time.
      console.warn("account_resource_token_cache_failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return {
    async tokenFor({ sessionId, record }, resource, scope = PORTFOLIO_READ_SCOPE) {
      const key = cacheKey(resource, scope);
      const cached = record.resourceTokens?.[key];
      if (cached && cached.expiresAtMs - EXPIRY_SKEW_MS > now()) return cached.token;

      const issued = await deps.tokenEndpoint.requestToken(
        new URLSearchParams({
          grant_type: TOKEN_EXCHANGE_GRANT,
          subject_token: record.idToken,
          subject_token_type: ID_TOKEN_TYPE,
          requested_token_type: ACCESS_TOKEN_TYPE,
          resource: LAX_RESOURCES[resource].uri,
          scope,
        }),
      );
      const expiresAtMs = now() + (issued.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS) * 1000;
      await cacheToken(sessionId, key, { token: issued.access_token, expiresAtMs });
      return issued.access_token;
    },
  };
}
