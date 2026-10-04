import { buildAuthorizeUrl, generateOAuthLoginParams } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";

export type PendingStaffLogin = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
};

export function startStaffLogin(input: {
  config: ShopAdminConfig;
  returnTo: string;
}): { authorizeUrl: URL; pending: PendingStaffLogin } {
  const params = generateOAuthLoginParams();
  const redirectUri = `${input.config.publicOrigin}/api/auth/callback`;
  const href = buildAuthorizeUrl({
    authorizationEndpoint: new URL(
      "/api/auth/oauth2/authorize",
      input.config.oidcIssuer,
    ).toString(),
    clientId: input.config.oidcClientId,
    redirectUri,
    scopes: ["openid", "profile", "email", "offline_access", "shop.admin"],
    state: params.state,
    nonce: params.nonce,
    codeChallenge: params.codeChallenge,
  });
  const authorizeUrl = new URL(href);
  authorizeUrl.searchParams.set("acr_values", "urn:mace:incommon:iap:silver");
  return {
    authorizeUrl,
    pending: {
      state: params.state,
      nonce: params.nonce,
      codeVerifier: params.codeVerifier,
      returnTo: input.returnTo,
    },
  };
}
