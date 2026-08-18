import type { AuthenticatedUser, IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IBidUserContextLoader } from "../services/interfaces/bid-user-context.js";

/** Resolves Identity subject only (cookie/JWT) without product authorization. */
export interface IIdentityAuthenticator {
  getIdentityPrincipal(
    headers: Headers,
  ): Promise<{ id: string; identitySessionId?: string; scopes: readonly string[] } | null>;
}

export class IdentityPrincipalAuthenticator implements IIdentityAuthenticator {
  constructor(private readonly inner: IAuthenticator) {}

  async getIdentityPrincipal(
    headers: Headers,
  ): Promise<{ id: string; identitySessionId?: string; scopes: readonly string[] } | null> {
    const session = await this.inner.getSessionUser(headers);
    if (!session?.id) return null;
    return {
      id: session.id,
      scopes: session.scopes ?? [],
      ...(session.identitySessionId ? { identitySessionId: session.identitySessionId } : {}),
    };
  }
}

/**
 * D13: authenticate centrally, authorize locally — loads Bid role/staff from
 * `bid_user_profile` (dual-read during migration).
 */
export class BidContextEnrichedAuthenticator implements IAuthenticator {
  constructor(
    private readonly identity: IIdentityAuthenticator,
    private readonly bidContext: IBidUserContextLoader,
  ) {}

  async getSessionUser(headers: Headers): Promise<AuthenticatedUser | null> {
    const principal = await this.identity.getIdentityPrincipal(headers);
    if (!principal) return null;
    const context = await this.bidContext.loadContext(principal.id);
    if (!context) return null;
    if (context.identityDisabledAt || context.mergedIntoSubjectId) return null;
    return {
      id: principal.id,
      scopes: principal.scopes ?? [],
      ...(principal.identitySessionId ? { identitySessionId: principal.identitySessionId } : {}),
      role: context.role,
      staffRole: context.staffRole ?? null,
    };
  }
}
