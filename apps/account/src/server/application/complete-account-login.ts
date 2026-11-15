import { randomBytes } from "node:crypto";
import { PENDING_LOGIN_MAX_AGE_SECONDS } from "@/lib/pending-login-cookie";
import {
  ACCOUNT_STEP_UP_MAX_AGE_SECONDS,
  issuerJwksUrl,
  normalizeIssuerUrl,
} from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { assertRecentAuthentication, validateOAuthStateTimingSafe } from "@auction/identity-rp";
import type { LaxAccountConfig } from "../config";
import { createAccountTokenEndpoint } from "../infrastructure/account-token-endpoint";
import type { SessionStore, StaffSessionRecord } from "../ports/session-store";
import { assertReauthSubject } from "./confirm-reauth-subject";
import type { PendingAccountLogin } from "./start-account-login";

/** Outlives the pending cookie (and the clock skew it allows), so a claim is never forgotten early. */
const PENDING_LOGIN_RECORD_TTL_SECONDS = PENDING_LOGIN_MAX_AGE_SECONDS + 60;

/** The sign-in was ended by a sign-out, or its callback already ran: no session may come of it. */
export class PendingLoginEndedError extends Error {
  constructor() {
    super("Pending sign-in already used or ended by sign-out");
    this.name = "PendingLoginEndedError";
  }
}

/** Ends a sign-in still in flight when this browser signs out; see `completeAccountLogin`. */
export async function endPendingAccountLogin(input: {
  pending: Pick<PendingAccountLogin, "state">;
  sessions: SessionStore;
}): Promise<void> {
  await input.sessions.revokePendingLogin(input.pending.state, PENDING_LOGIN_RECORD_TTL_SECONDS);
}

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
  // One callback per sign-in, and none once this browser has signed out: the code is not even
  // exchanged for a sign-in that a sign-out ended.
  if (
    !(await input.sessions.claimPendingLogin(input.pending.state, PENDING_LOGIN_RECORD_TTL_SECONDS))
  ) {
    throw new PendingLoginEndedError();
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
  const jwksUrl = issuerJwksUrl(input.config.oidcInternalIssuer);
  const verified = await verifyIdentityToken({
    token: token.id_token,
    jwksUrl,
    issuer,
    audience: input.config.oidcClientId,
  });
  if (!verified || verified.payload.nonce !== input.pending.nonce) {
    throw new Error("Invalid id_token");
  }
  if (input.pending.reauth) {
    // The issuer is asked for a fresh sign-in, but an answer that ignores that must not unlock
    // a sensitive change: the issuer checks recency again, and so do we.
    assertRecentAuthentication({
      authTime:
        typeof verified.payload.auth_time === "number" ? verified.payload.auth_time : undefined,
      maxAgeSeconds: ACCOUNT_STEP_UP_MAX_AGE_SECONDS,
    });
    // And it must be the person who asked: a passkey for someone else is not a step-up.
    assertReauthSubject(input.pending, verified.subject);
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
  // A sign-out that landed during the exchange wins: the session it could not see is ended here.
  if (!(await input.sessions.settlePendingLogin(input.pending.state, sessionId))) {
    await input.sessions.delete(sessionId);
    throw new PendingLoginEndedError();
  }
  return {
    sessionId,
    returnTo: input.pending.returnTo,
    email,
    subject: verified.subject,
  };
}
