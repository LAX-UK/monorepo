import { JWKS_PATH, normalizeIssuerUrl } from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { createFetchTokenEndpoint } from "@auction/identity-rp";
import { exchangeForShopApiToken } from "../application/exchange-shop-api-token";
import type { ShopAdminConfig } from "../config";
import type { StaffSessionRenewal } from "../ports/staff-session-renewal";

/** Renews staff sessions against the Identity issuer's token endpoint and JWKS. */
export function createOidcStaffSessionRenewal(config: ShopAdminConfig): StaffSessionRenewal {
  const tokenEndpoint = createFetchTokenEndpoint({
    tokenEndpointUrl: `${config.oidcInternalIssuer}/api/auth/oauth2/token`,
    auth: { kind: "basic", clientId: config.oidcClientId, clientSecret: config.oidcClientSecret },
    timeoutMs: 15_000,
  });
  const issuer = normalizeIssuerUrl(config.oidcIssuer);
  const jwksUrl = `${config.oidcInternalIssuer.replace(/\/+$/, "")}${JWKS_PATH}`;
  return {
    refresh: (refreshToken) =>
      tokenEndpoint.requestToken(
        new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      ),
    async verifyIdToken(idToken) {
      const verified = await verifyIdentityToken({
        token: idToken,
        jwksUrl,
        issuer,
        audience: config.oidcClientId,
      });
      if (!verified) return null;
      const { auth_time: authTime, acr } = verified.payload;
      return {
        ...(typeof authTime === "number" ? { authTime } : {}),
        ...(typeof acr === "string" ? { acr } : {}),
      };
    },
    exchangeForShopApi: (idToken) => exchangeForShopApiToken({ config, idToken }),
  };
}
