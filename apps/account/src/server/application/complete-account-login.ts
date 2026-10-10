import { randomBytes } from "node:crypto";
import { JWKS_PATH, normalizeIssuerUrl } from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { validateOAuthStateTimingSafe } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";
import { createAccountTokenEndpoint } from "../infrastructure/account-token-endpoint";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";
import type { PendingAccountLogin } from "./start-account-login";
export async function completeAccountLogin(input: {
  config: LaxAccountConfig;
  pending: PendingAccountLogin;
  receivedState: string;
  code: string;
  sessions: SessionStore;
}): Promise<{ sessionId: string; returnTo: string; email: string | null; subject: string }> {
  if (!validateOAuthStateTimingSafe(input.pending.state, input.receivedState)) {
    throw new Error("Invalid OAuth state");
  }
  const redirectUri = `${input.config.publicOrigin}/api/auth/callback`;
  const tokenEndpoint = createAccountTokenEndpoint(input.config);
  const token = await tokenEndpoint.requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri,
      code_verifier: input.pending.codeVerifier,
    }),
  );
  if (!token.id_token || !token.refresh_token || typeof token.expires_in !== "number") {
    throw new Error("Identity token response incomplete");
  }
  const issuer = normalizeIssuerUrl(input.config.oidcIssuer);
  const jwksUrl = `${input.config.oidcInternalIssuer.replace(/\/+$/, "")}${JWKS_PATH}`;
  const verified = await verifyIdentityToken({
    token: token.id_token,
    jwksUrl,
    issuer,
    audience: input.config.oidcClientId,
  });
  if (!verified || verified.payload.nonce !== input.pending.nonce) {
    throw new Error("Invalid id_token");
  }
  const authTime =
    typeof verified.payload.auth_time === "number"
      ? verified.payload.auth_time
      : Math.floor(Date.now() / 1000);
  const sid = typeof verified.payload.sid === "string" ? verified.payload.sid : "";
  const email = typeof verified.payload.email === "string" ? verified.payload.email : null;
  const record: StaffSessionRecord = {
    subject: verified.subject,
    sid,
    idToken: token.id_token,
    accessToken: token.access_token ?? "",
    refreshToken: token.refresh_token,
    accessTokenExpiresAtMs: Date.now() + token.expires_in * 1000,
    authTime,
    acr: typeof verified.payload.acr === "string" ? verified.payload.acr : "",
  };
  const sessionId = randomBytes(32).toString("base64url");
  await input.sessions.save(sessionId, record, input.config.sessionTtlSeconds);
  return {
    sessionId,
    returnTo: input.pending.returnTo,
    email,
    subject: verified.subject,
  };
}
