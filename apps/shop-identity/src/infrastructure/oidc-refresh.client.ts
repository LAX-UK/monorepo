import type {
  OidcRefreshClient,
  OidcRefreshResult,
} from "../application/ports/oidc-refresh.ports.js";
import { refreshExpiresAtFromNow } from "../application/token-expiry.js";
import { ShopIdentityReauthRequiredError } from "../errors/shop-identity-reauth.error.js";
import { ShopIdentityUpstreamError } from "../errors/shop-identity-upstream.error.js";
import type { OidcDiscovery } from "../oidc.js";
import { refreshOAuthTokens } from "../oidc.js";

export function createOidcRefreshClient(input: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): OidcRefreshClient {
  const now = input.now ?? (() => Date.now());
  return {
    async refresh(refreshToken: string): Promise<OidcRefreshResult> {
      try {
        const response = await refreshOAuthTokens({
          discovery: input.discovery,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          refreshToken,
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        });
        return {
          idToken: response.id_token,
          refreshToken: response.refresh_token ?? refreshToken,
          refreshExpiresAt: refreshExpiresAtFromNow(now()),
        };
      } catch (error) {
        const status = (error as { status?: number }).status;
        const body = (error as { body?: string }).body ?? "";
        if (status === 400 && body.includes("invalid_grant")) {
          throw new ShopIdentityReauthRequiredError("refresh_rejected");
        }
        if (error instanceof ShopIdentityReauthRequiredError) {
          throw error;
        }
        throw new ShopIdentityUpstreamError(
          error instanceof Error ? error.message : "OIDC refresh failed",
          "oidc_token_exchange",
          status,
        );
      }
    },
  };
}
