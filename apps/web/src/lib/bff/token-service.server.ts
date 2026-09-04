import "server-only";

import type { LaxResourceId } from "@auction/identity-contracts";
import {
  IdentityTokenEndpointError,
  exchangeResourceToken,
  refreshIdentityTokens,
} from "./oidc.server";
import { getBffRedis } from "./redis.server";
import { type AuthenticatedBidSession, BidBffSessionStore } from "./session-store.server";

const EXPIRY_SKEW_MS = 30_000;

function parseScopes(scopes: string): Set<string> {
  return new Set(scopes.split(/\s+/).filter(Boolean));
}

/** Reuse a cached resource token when its granted scopes cover the request. */
function scopesSatisfy(cachedScopes: string, requestedScopes: string): boolean {
  const cached = parseScopes(cachedScopes);
  for (const scope of parseScopes(requestedScopes)) {
    if (!cached.has(scope)) return false;
  }
  return true;
}

function cachedResourceTokenStillValid(
  cached: { scopes: string; expiresAt: number } | undefined,
  scopes: string,
  forceExchange: boolean,
): cached is { scopes: string; expiresAt: number; token: string } {
  return (
    !forceExchange &&
    cached !== undefined &&
    scopesSatisfy(cached.scopes, scopes) &&
    cached.expiresAt > Date.now() + EXPIRY_SKEW_MS
  );
}

export class BidBffSessionRequiredError extends Error {
  constructor() {
    super("BFF session is not authenticated");
    this.name = "BidBffSessionRequiredError";
  }
}

export class BidBffTokenService {
  constructor(private readonly sessions = new BidBffSessionStore(getBffRedis())) {}

  async readAuthenticated(sessionId: string): Promise<AuthenticatedBidSession | null> {
    const session = await this.sessions.read(sessionId);
    return session?.kind === "authenticated" ? session : null;
  }

  async resourceToken(
    sessionId: string,
    audience: LaxResourceId,
    scopes: string,
    forceExchange = false,
  ): Promise<{ token: string; session: AuthenticatedBidSession }> {
    const session = await this.readAuthenticated(sessionId);
    if (!session) throw new BidBffSessionRequiredError();
    const cached = session.resourceTokens[audience as keyof typeof session.resourceTokens];
    if (cachedResourceTokenStillValid(cached, scopes, forceExchange)) {
      return { token: cached.token, session };
    }

    return this.sessions.withRefreshLock(sessionId, async (lock) => {
      let current = await this.readAuthenticated(sessionId);
      if (!current) throw new BidBffSessionRequiredError();
      const currentCached = current.resourceTokens[audience as keyof typeof current.resourceTokens];
      if (cachedResourceTokenStillValid(currentCached, scopes, forceExchange)) {
        return { token: currentCached.token, session: current };
      }
      if (current.accessTokenExpiresAt <= Date.now() + EXPIRY_SKEW_MS) {
        try {
          current = await refreshIdentityTokens(current);
        } catch (error) {
          if (
            error instanceof IdentityTokenEndpointError &&
            error.status !== null &&
            error.status >= 400 &&
            error.status < 500
          ) {
            throw new BidBffSessionRequiredError();
          }
          throw error;
        }
      }
      const resource = await exchangeResourceToken(current, audience, scopes);
      current = {
        ...current,
        resourceTokens: { ...current.resourceTokens, [audience]: resource },
      };
      if (!(await lock.updateAuthenticated(current))) {
        throw new BidBffSessionRequiredError();
      }
      return { token: resource.token, session: current };
    });
  }
}
