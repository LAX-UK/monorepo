import { randomBytes } from "node:crypto";
import { JWKS_PATH, normalizeIssuerUrl } from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { createFetchTokenEndpoint, validateOAuthStateTimingSafe } from "@auction/identity-rp";
import type { ShopAdminConfig } from "../config";
import { assertSilverAcr } from "../domain/acr-policy";
import { StaffLoginError } from "../domain/staff-login-failure";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";
import type { PendingStaffLogin } from "./start-staff-login";

export async function completeStaffLogin(input: {
  config: ShopAdminConfig;
  pending: PendingStaffLogin;
  receivedState: string;
  code: string;
  sessions: SessionStore;
}): Promise<{ sessionId: string; returnTo: string }> {
  if (!validateOAuthStateTimingSafe(input.pending.state, input.receivedState)) {
    throw new StaffLoginError("invalid_state", "Invalid OAuth state");
  }
  const redirectUri = `${input.config.publicOrigin}/api/auth/callback`;
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
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri,
      code_verifier: input.pending.codeVerifier,
    }),
  );
  if (!token.id_token || !token.refresh_token || typeof token.expires_in !== "number") {
    throw new StaffLoginError("token_exchange_failed", "Identity token response incomplete");
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
    throw new StaffLoginError("invalid_id_token", "Invalid id_token");
  }
  const acr = typeof verified.payload.acr === "string" ? verified.payload.acr : undefined;
  assertSilverAcr(acr);
  const authTime =
    typeof verified.payload.auth_time === "number"
      ? verified.payload.auth_time
      : Math.floor(Date.now() / 1000);
  const sid = typeof verified.payload.sid === "string" ? verified.payload.sid : "";
  const record: StaffSessionRecord = {
    subject: verified.subject,
    sid,
    idToken: token.id_token,
    accessToken: token.access_token ?? "",
    refreshToken: token.refresh_token,
    accessTokenExpiresAtMs: Date.now() + token.expires_in * 1000,
    authTime,
    acr: acr ?? "",
  };
  const sessionId = randomBytes(32).toString("base64url");
  await input.sessions.save(sessionId, record, input.config.sessionTtlSeconds);
  return { sessionId, returnTo: input.pending.returnTo };
}
