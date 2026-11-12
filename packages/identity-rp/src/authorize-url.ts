import type { OidcAuthorizePrompt } from "./authorize-prompt.js";

export function buildAuthorizeUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  codeChallenge: string;
  prompt?: OidcAuthorizePrompt;
  /** OAuth `max_age` — requires a fresh login when combined with `prompt=login`. */
  maxAge?: number;
  /** OIDC `login_hint`: an email the relying party already knows, prefilled at sign-in. */
  loginHint?: string;
  /** Why the person is here, so the hosted page can say so ("sell"); it changes wording only. */
  hostedContext?: "sell";
  /**
   * Why a fresh sign-in is asked for (a word from the issuer's fixed list, see
   * `ACCOUNT_STEP_UP_REASONS`), so the hosted page can say so. It changes wording only.
   */
  reauthReason?: string;
}): string {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scopes.join(" "));
  if (input.prompt) url.searchParams.set("prompt", input.prompt);
  if (input.maxAge != null && Number.isFinite(input.maxAge)) {
    url.searchParams.set("max_age", String(Math.max(0, Math.floor(input.maxAge))));
  }
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  if (input.hostedContext) url.searchParams.set("hosted_context", input.hostedContext);
  if (input.reauthReason) url.searchParams.set("reauth_reason", input.reauthReason);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
