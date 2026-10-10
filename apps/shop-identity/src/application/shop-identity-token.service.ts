import { ShopIdentityReauthRequiredError } from "../errors/shop-identity-reauth.error.js";
import type { OidcRefreshClient } from "./ports/oidc-refresh.ports.js";
import type {
  SessionTokenReadOptions,
  SessionTokenStore,
  SessionTokens,
} from "./ports/session-token.ports.js";
import { isIdTokenFresh } from "./token-expiry.js";

export type ShopIdentityTokenService = {
  /** `maxAgeMs` also rotates tokens issued earlier, so claims reflect recent identity changes. */
  resolveIdToken(
    sessionId: string,
    options?: SessionTokenReadOptions & { maxAgeMs?: number },
  ): Promise<string>;
  persist(sessionId: string, tokens: SessionTokens): Promise<void>;
  clear(sessionId: string): Promise<void>;
  hasStoredRefreshToken(sessionId: string): Promise<boolean>;
  readIdTokenForLogout(sessionId: string): Promise<string | null>;
};

export function createShopIdentityTokenService(deps: {
  store: SessionTokenStore;
  refresh: OidcRefreshClient;
  onRotate?: (sessionId: string) => void;
  now?: () => number;
}): ShopIdentityTokenService {
  const now = deps.now ?? (() => Date.now());

  return {
    async resolveIdToken(sessionId, resolveOptions) {
      const { maxAgeMs, ...options } = resolveOptions ?? {};
      const usable = (idToken: string) => isIdTokenFresh(idToken, now(), undefined, maxAgeMs);
      const current = await deps.store.read(sessionId, options);
      if (!current) {
        throw new ShopIdentityReauthRequiredError("no_session");
      }
      if (usable(current.idToken)) {
        return current.idToken;
      }
      if (!current.refreshToken) {
        throw new ShopIdentityReauthRequiredError("no_refresh_token");
      }

      return deps.store.withLock(sessionId, async (ctx) => {
        const locked = ctx.current ?? (await deps.store.read(sessionId, options));
        if (locked && usable(locked.idToken)) {
          return locked.idToken;
        }
        const refreshToken = locked?.refreshToken;
        if (!refreshToken) {
          throw new ShopIdentityReauthRequiredError("no_refresh_token");
        }
        const rotated = await deps.refresh.refresh(refreshToken);
        const next: SessionTokens = {
          idToken: rotated.idToken,
          refreshToken: rotated.refreshToken,
          refreshExpiresAt: rotated.refreshExpiresAt,
        };
        await ctx.save(next);
        deps.onRotate?.(sessionId);
        return next.idToken;
      });
    },

    persist(sessionId, tokens) {
      return deps.store.save(sessionId, tokens);
    },

    clear(sessionId) {
      return deps.store.clear(sessionId);
    },

    hasStoredRefreshToken(sessionId) {
      return deps.store.hasStoredRefreshToken(sessionId);
    },

    async readIdTokenForLogout(sessionId) {
      const tokens = await deps.store.read(sessionId);
      return tokens?.idToken ?? null;
    },
  };
}
