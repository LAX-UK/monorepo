import { LAX_RESOURCES } from "@auction/identity-contracts";
import { createFetchTokenEndpoint } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/**
 * The authorization-code access token is opaque and not audience-bound to Shop API, which only
 * accepts `lax-shop-api` JWTs. Staff sessions therefore exchange their ID token (RFC 8693) for a
 * `shop.admin` resource token, which also carries `acr` and `auth_time` for step-up checks.
 */
export async function exchangeForShopApiToken(input: {
  config: ShopAdminConfig;
  idToken: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const tokenEndpoint = createFetchTokenEndpoint({
    tokenEndpointUrl: `${input.config.oidcInternalIssuer}/api/auth/oauth2/token`,
    auth: {
      kind: "basic",
      clientId: input.config.oidcClientId,
      clientSecret: input.config.oidcClientSecret,
    },
    timeoutMs: 15_000,
  });
  const token = await tokenEndpoint.requestToken(
    new URLSearchParams({
      grant_type: TOKEN_EXCHANGE_GRANT,
      subject_token: input.idToken,
      subject_token_type: ID_TOKEN_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      resource: LAX_RESOURCES["lax-shop-api"].uri,
      scope: "shop.admin",
    }),
  );
  if (!token.access_token || typeof token.expires_in !== "number") {
    throw new Error("Shop API token exchange returned an incomplete response");
  }
  return { accessToken: token.access_token, expiresInSeconds: token.expires_in };
}
