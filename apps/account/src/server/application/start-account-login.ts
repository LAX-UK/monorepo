import { buildAuthorizeUrl, generateOAuthLoginParams } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";

export type PendingAccountLogin = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
};

export function startAccountLogin(input: {
  config: LaxAccountConfig;
  returnTo: string;
}): { authorizeUrl: URL; pending: PendingAccountLogin } {
  const params = generateOAuthLoginParams();
  const redirectUri = `${input.config.publicOrigin}/api/auth/callback`;
  const href = buildAuthorizeUrl({
    authorizationEndpoint: new URL(
      "/api/auth/oauth2/authorize",
      input.config.oidcIssuer,
    ).toString(),
    clientId: input.config.oidcClientId,
    redirectUri,
    scopes: ["openid", "profile", "email", "offline_access", "phone"],
    state: params.state,
    nonce: params.nonce,
    codeChallenge: params.codeChallenge,
  });
  return {
    authorizeUrl: new URL(href),
    pending: {
      state: params.state,
      nonce: params.nonce,
      codeVerifier: params.codeVerifier,
      returnTo: input.returnTo,
    },
  };
}
