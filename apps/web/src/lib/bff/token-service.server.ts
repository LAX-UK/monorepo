import "server-only";

import type { LaxResourceId } from "@auction/identity-contracts";
import {
  exchangeResourceToken,
  isIdentityRejected,
  isIdentityUnavailable,
  isResourceTokenKeyCurrent,
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

type CachedResourceToken = { scopes: string; expiresAt: number; token: string };

/** Whether the issuer still publishes the key that signed a cached token. */
export type SigningKeyCheck = (token: string) => Promise<boolean>;

/**
 * A cached token is reused only while it is unexpired, covers the scopes and was signed by a
 * key the issuer still publishes, so a rotated-out key never outlives the rotation.
 */
async function reusableResourceToken(
  cached: CachedResourceToken | undefined,
  scopes: string,
  forceExchange: boolean,
  isKeyCurrent: SigningKeyCheck,
): Promise<CachedResourceToken | null> {
  if (
    forceExchange ||
    cached === undefined ||
    !scopesSatisfy(cached.scopes, scopes) ||
    cached.expiresAt <= Date.now() + EXPIRY_SKEW_MS
  ) {
    return null;
  }
  return (await isKeyCurrent(cached.token)) ? cached : null;
}

export class BidBffSessionRequiredError extends Error {
  constructor() {
    super("BFF session is not authenticated");
    this.name = "BidBffSessionRequiredError";
  }
}

export class BidBffIdentityUnavailableError extends Error {
  constructor(message = "Identity issuer is temporarily unavailable") {
    super(message);
    this.name = "BidBffIdentityUnavailableError";
  }
}

function mapIssuerFailure(error: unknown): never {
  if (isIdentityRejected(error)) {
    throw new BidBffSessionRequiredError();
  }
  if (isIdentityUnavailable(error)) {
    throw new BidBffIdentityUnavailableError();
  }
  throw error;
}

export class BidBffTokenService {
  constructor(
    private readonly sessions = new BidBffSessionStore(getBffRedis()),
    private readonly isKeyCurrent: SigningKeyCheck = isResourceTokenKeyCurrent,
  ) {}

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
    const reusable = await reusableResourceToken(cached, scopes, forceExchange, this.isKeyCurrent);
    if (reusable) {
      return { token: reusable.token, session };
    }

    return this.sessions.withRefreshLock(sessionId, async (lock) => {
      let current = await this.readAuthenticated(sessionId);
      if (!current) throw new BidBffSessionRequiredError();
      const currentCached = current.resourceTokens[audience as keyof typeof current.resourceTokens];
      const reusableCurrent = await reusableResourceToken(
        currentCached,
        scopes,
        forceExchange,
        this.isKeyCurrent,
      );
      if (reusableCurrent) {
        return { token: reusableCurrent.token, session: current };
      }
      if (current.accessTokenExpiresAt <= Date.now() + EXPIRY_SKEW_MS) {
        try {
          current = await refreshIdentityTokens(current);
        } catch (error) {
          mapIssuerFailure(error);
        }
      }
      let resource: Awaited<ReturnType<typeof exchangeResourceToken>>;
      try {
        resource = await exchangeResourceToken(current, audience, scopes);
      } catch (error) {
        mapIssuerFailure(error);
      }
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
