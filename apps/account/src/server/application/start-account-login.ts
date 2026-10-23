import { ACCOUNT_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts";
import { buildAuthorizeUrl, generateOAuthLoginParams } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";

export type PendingAccountLogin = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  /** Set when the person was sent here to prove it is still them; see completeAccountLogin. */
  reauth?: boolean;
};

export function startAccountLogin(input: {
  config: LaxAccountConfig;
  returnTo: string;
  /** Forces a fresh sign-in, so the new ID token's `auth_time` is recent. */
  reauth?: boolean;
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
    ...(input.reauth ? { prompt: "login", maxAge: ACCOUNT_STEP_UP_MAX_AGE_SECONDS } : {}),
  });
  return {
    authorizeUrl: new URL(href),
    pending: {
      state: params.state,
      nonce: params.nonce,
      codeVerifier: params.codeVerifier,
      returnTo: input.returnTo,
      ...(input.reauth ? { reauth: true } : {}),
    },
  };
}
